import { Hono } from "hono";
import { decodeEventLog, encodeFunctionData, parseUnits, type Address, type Hex } from "viem";
import { z } from "zod";

import { rotatingSavingsPoolAbi } from "@arcloop/web3";

import { env } from "../config/env";
import { publicClient, rotatingSavingsPoolAddress } from "../config/contracts";
import {
  createPoolMetadata,
  getPoolById,
  recordContributionMade,
  recordMemberJoined,
  recordPayoutReleased,
  recordPoolCompleted,
  recordPoolStarted,
  refreshPoolFromChain
} from "../services/pool-service";
import {
  approveAbiParameterCount,
  approveFunctionSignature,
  CircleSocialDeviceTokenError,
  circleSocialDeviceTokenHardTimeoutMs,
  contributeAbiParameterCount,
  contributeFunctionSignature,
  createCircleContractExecutionTransaction,
  createPoolAbiParameterCount,
  createPoolFunctionSignature,
  createCircleUserControlledTransaction,
  CircleTransactionRequestError,
  createSocialLoginDeviceToken,
  createUserPinSetupChallenge,
  createUserWallet,
  finalizeCircleUserControlledTransaction,
  getCircleConfigurationStatus,
  getSafeCircleError,
  getUserWallet,
  joinPoolAbiParameterCount,
  joinPoolFunctionSignature
} from "../services/circle-wallet-service";

export const walletsRoutes = new Hono();

const createPoolTransactionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  contributionAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,6})?$/, "Use a positive USDC amount with up to 6 decimals."),
  maxMembers: z.coerce.number().int().min(2).max(100)
});

const finalizePoolTransactionSchema = z.object({
  challengeId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional()
});

const finalizePoolActionTransactionSchema = z.object({
  challengeId: z.string().trim().min(1).max(200),
  action: z.enum(["approve", "join", "contribute"])
});

const socialDeviceTokenSchema = z.object({
  deviceId: z.string().trim().min(1).max(500)
});

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "ok", type: "bool" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "allowance", type: "uint256" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
  }
] as const;

type PoolReceiptEventName =
  | "MemberJoined"
  | "PoolStarted"
  | "ContributionMade"
  | "PayoutReleased"
  | "PoolCompleted";

type PoolReceiptEvent = {
  eventName: PoolReceiptEventName;
  eventArgs: Record<string, unknown>;
  blockNumber: number;
  logIndex: number;
};

function circleTransactionFailureStatus(status: number | null) {
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409) {
    return status;
  }

  return 502;
}

function createCircleSocialDeviceTokenTimeout() {
  return new CircleSocialDeviceTokenError(
    "Circle social device token request timed out.",
    null,
    "timeout"
  );
}

function createHardTimeoutPromise() {
  let timeoutId: ReturnType<typeof setTimeout>;

  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.info("[Circle social device token]", {
        status: null,
        category: "timeout"
      });
      reject(createCircleSocialDeviceTokenTimeout());
    }, circleSocialDeviceTokenHardTimeoutMs);
  });

  return {
    promise,
    clear: () => clearTimeout(timeoutId)
  };
}

const createPoolTransactionHardTimeoutMs = 6_000;
const createPoolTransactionTimeoutMessage = "Circle create transaction request timed out.";

class CreatePoolTransactionTimeoutError extends Error {
  constructor() {
    super(createPoolTransactionTimeoutMessage);
    this.name = "CreatePoolTransactionTimeoutError";
  }
}

function createCreatePoolTransactionTimeoutPromise() {
  let timeoutId: ReturnType<typeof setTimeout>;

  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.info("[Circle create transaction]", {
        status: null,
        category: "timeout"
      });
      reject(new CreatePoolTransactionTimeoutError());
    }, createPoolTransactionHardTimeoutMs);
  });

  return {
    promise,
    clear: () => clearTimeout(timeoutId)
  };
}

class JsonRouteError extends Error {
  constructor(
    readonly status: 400,
    readonly error: unknown
  ) {
    super("JSON route error");
    this.name = "JsonRouteError";
  }
}

async function readSocialDeviceTokenRequest(c: {
  req: {
    header: (name: string) => string | undefined;
    raw: Request;
  };
}) {
  const headerDeviceId = c.req.header("x-circle-device-id")?.trim() ?? "";

  if (headerDeviceId) {
    const parsed = socialDeviceTokenSchema.safeParse({ deviceId: headerDeviceId });

    if (!parsed.success) {
      throw new JsonRouteError(400, parsed.error.flatten());
    }

    return parsed.data;
  }

  if (process.env.NODE_ENV === "production") {
    throw new JsonRouteError(400, {
      formErrors: [],
      fieldErrors: {
        deviceId: ["Required"]
      }
    });
  }

  console.info("[Circle social device token]", {
    status: null,
    category: "body_read_start"
  });

  let text: string;
  try {
    text = await c.req.raw.clone().text();
  } catch {
    throw new JsonRouteError(400, "Unable to read request body.");
  }

  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  const parsed = socialDeviceTokenSchema.safeParse(json);

  if (!parsed.success) {
    throw new JsonRouteError(400, parsed.error.flatten());
  }

  return parsed.data;
}

async function runSocialDeviceTokenRoute(c: {
  req: {
    header: (name: string) => string | undefined;
    raw: Request;
  };
}) {
  const input = await readSocialDeviceTokenRequest(c);

  console.info("[Circle social device token]", {
    status: null,
    category: "route_start"
  });

  return createSocialLoginDeviceToken(input.deviceId);
}

async function readCreatePoolTransactionRequest(c: {
  req: {
    raw: Request;
  };
}) {
  let text: string;

  try {
    text = await c.req.raw.clone().text();
  } catch {
    throw new JsonRouteError(400, "Unable to read request body.");
  }

  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  const parsed = createPoolTransactionSchema.safeParse(json);

  if (!parsed.success) {
    throw new JsonRouteError(400, parsed.error.flatten());
  }

  return parsed.data;
}

function getBearerUserToken(c: { req: { header: (name: string) => string | undefined } }) {
  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? null;
}

async function getCreatedPoolIdFromReceipt(transactionHash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
    timeout: 60_000
  });

  if (receipt.status !== "success") {
    return { onchainPoolId: null, blockNumber: Number(receipt.blockNumber), confirmed: false };
  }

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== rotatingSavingsPoolAddress) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: rotatingSavingsPoolAbi,
        data: log.data,
        topics: log.topics
      });

      if (decoded.eventName === "PoolCreated") {
        const args = decoded.args as { poolId?: bigint };
        return {
          onchainPoolId: typeof args.poolId === "bigint" ? Number(args.poolId) : null,
          blockNumber: Number(receipt.blockNumber),
          confirmed: true
        };
      }
    } catch {
      // Ignore logs from other contracts or incompatible event signatures in the receipt.
    }
  }

  return { onchainPoolId: null, blockNumber: Number(receipt.blockNumber), confirmed: true };
}

async function getPoolEventsFromReceipt(transactionHash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
    timeout: 60_000
  });

  if (receipt.status !== "success") {
    return {
      events: [],
      blockNumber: Number(receipt.blockNumber),
      confirmed: false
    };
  }

  const events: PoolReceiptEvent[] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== rotatingSavingsPoolAddress) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: rotatingSavingsPoolAbi,
        data: log.data,
        topics: log.topics
      });

      if (
        decoded.eventName === "MemberJoined" ||
        decoded.eventName === "PoolStarted" ||
        decoded.eventName === "ContributionMade" ||
        decoded.eventName === "PayoutReleased" ||
        decoded.eventName === "PoolCompleted"
      ) {
        events.push({
          eventName: decoded.eventName,
          eventArgs: decoded.args as Record<string, unknown>,
          blockNumber: Number(receipt.blockNumber),
          logIndex: log.logIndex
        });
      }
    } catch {
      // Ignore logs from other contracts or incompatible event signatures in the receipt.
    }
  }

  return {
    events,
    blockNumber: Number(receipt.blockNumber),
    confirmed: true
  };
}

async function waitForSuccessfulReceipt(transactionHash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
    timeout: 60_000
  });

  return {
    confirmed: receipt.status === "success",
    blockNumber: Number(receipt.blockNumber)
  };
}

function poolActionFailureStatus(status: number | null) {
  return circleTransactionFailureStatus(status);
}

function getPoolActionMessage(action: "approve" | "join" | "contribute") {
  if (action === "approve") {
    return "Circle returned a user approval challenge for USDC approval.";
  }

  if (action === "join") {
    return "Circle returned a user approval challenge for joining the pool.";
  }

  return "Circle returned a user approval challenge for contributing to the pool.";
}

function getPoolActionSignature(action: "approve" | "join" | "contribute") {
  if (action === "approve") {
    return approveFunctionSignature;
  }

  if (action === "join") {
    return joinPoolFunctionSignature;
  }

  return contributeFunctionSignature;
}

function getPoolActionAbiParameterCount(action: "approve" | "join" | "contribute") {
  if (action === "approve") {
    return approveAbiParameterCount;
  }

  if (action === "join") {
    return joinPoolAbiParameterCount;
  }

  return contributeAbiParameterCount;
}

walletsRoutes.get("/wallets/circle/config", (c) =>
  c.json({
    data: getCircleConfigurationStatus(),
    error: null
  })
);

walletsRoutes.post("/wallets/circle/social-device-token", async (c) => {
  console.info("[Circle social device token]", {
    status: null,
    category: "handler_entry"
  });

  const hardTimeout = createHardTimeoutPromise();
  try {
    const data = await Promise.race([
      runSocialDeviceTokenRoute(c),
      hardTimeout.promise
    ]).finally(hardTimeout.clear);

    return c.json({
      data,
      error: null
    });
  } catch (error) {
    if (error instanceof JsonRouteError) {
      return c.json(
        {
          data: null,
          error: error.error
        },
        error.status
      );
    }

    if (error instanceof CircleSocialDeviceTokenError) {
      return c.json(
        {
          data: null,
          error: error.message
        },
        error.category === "timeout" ? 504 : circleTransactionFailureStatus(error.status)
      );
    }

    return c.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Unable to create Circle device token."
      },
      502
    );
  }
});

walletsRoutes.get("/wallets/me", async (c) => {
  const userToken = getBearerUserToken(c);
  if (!userToken) {
    return c.json({ data: null, error: "Circle user token is required." }, 401);
  }

  try {
    const wallet = await getUserWallet(userToken);
    return c.json({
      data: {
        wallet,
        circle: getCircleConfigurationStatus()
      },
      error: null
    });
  } catch (error) {
    return c.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Unable to load Circle wallet."
      },
      502
    );
  }
});

walletsRoutes.post("/wallets/me", async (c) => {
  const userToken = getBearerUserToken(c);
  if (!userToken) {
    return c.json({ data: null, error: "Circle user token is required." }, 401);
  }

  try {
    const wallet = await createUserWallet(userToken);
    return c.json({
      data: {
        wallet,
        circle: getCircleConfigurationStatus()
      },
      error: null
    });
  } catch (error) {
    return c.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Unable to create Circle wallet."
      },
      502
    );
  }
});

walletsRoutes.post("/wallets/me/pin/setup", async (c) => {
  const userToken = getBearerUserToken(c);
  if (!userToken) {
    return c.json({ data: null, error: "Circle user token is required." }, 401);
  }

  try {
    const pin = await createUserPinSetupChallenge(userToken);
    return c.json({
      data: {
        pin,
        circle: getCircleConfigurationStatus()
      },
      error: null
    });
  } catch (error) {
    return c.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Unable to create Circle PIN setup challenge."
      },
      502
    );
  }
});

walletsRoutes.post("/wallets/me/pools/create-transaction", async (c) => {
  console.info("[Circle create transaction]", {
    status: null,
    category: "handler_entry"
  });

  const route = async () => {
    const userToken = getBearerUserToken(c);

    if (!userToken) {
      return c.json({ data: null, error: "Circle user token is required." }, 401);
    }

    console.info("[Circle create transaction]", {
      status: null,
      category: "route_start"
    });

    const input = await readCreatePoolTransactionRequest(c);
    const contributionAmount = parseUnits(input.contributionAmount, 6);

    if (contributionAmount <= 0n) {
      return c.json({ data: null, error: "Contribution amount must be greater than zero." }, 400);
    }

    const calldata = encodeFunctionData({
      abi: rotatingSavingsPoolAbi,
      functionName: "createPool",
      args: [env.USDC_TOKEN_ADDRESS as Address, contributionAmount, BigInt(input.maxMembers)]
    });

    try {
      const wallet = await getUserWallet(userToken);

      if (!wallet.walletId) {
        return c.json(
          {
            data: {
              pool: {
                title: input.title,
                description: input.description ?? null,
                contributionAmount: contributionAmount.toString(),
                maxMembers: input.maxMembers
              },
              wallet,
              transaction: {
                challengeId: null,
                transactionId: null,
                transactionHash: null,
                status: "WALLET_NOT_CREATED",
                message: "Create or complete a Circle wallet before creating a pool transaction."
              },
              request: {
                chainId: env.ARC_TESTNET_CHAIN_ID,
                contractAddress: rotatingSavingsPoolAddress,
                usdcTokenAddress: env.USDC_TOKEN_ADDRESS.toLowerCase(),
                explorerUrl: env.ARC_TESTNET_EXPLORER_URL,
                calldata
              }
            },
            error: null
          },
          200
        );
      }

      console.info("[Circle create transaction]", {
        status: null,
        category: "circle_transaction_start"
      });

      const transaction = await createCircleUserControlledTransaction({
        userToken,
        walletId: wallet.walletId,
        to: rotatingSavingsPoolAddress,
        contributionAmount: contributionAmount.toString(),
        maxMembers: input.maxMembers
      });

      return c.json(
        {
          data: {
            pool: {
              title: input.title,
              description: input.description ?? null,
              contributionAmount: contributionAmount.toString(),
              maxMembers: input.maxMembers
            },
            transaction,
            request: {
              chainId: env.ARC_TESTNET_CHAIN_ID,
              contractAddress: rotatingSavingsPoolAddress,
              usdcTokenAddress: env.USDC_TOKEN_ADDRESS.toLowerCase(),
              explorerUrl: env.ARC_TESTNET_EXPLORER_URL,
              calldata
            }
          },
          error: null
        },
        200
      );
    } catch (error) {
      if (error instanceof CircleTransactionRequestError && error.category === "timeout") {
        return c.json({ data: null, error: createPoolTransactionTimeoutMessage }, 504);
      }

      const safeError = getSafeCircleError(error);
      console.warn("[Circle create transaction]", {
        status: safeError.status,
        category: "error"
      });

      return c.json(
        {
          data: null,
          error: {
            code: safeError.code ?? "CIRCLE_TRANSACTION_CHALLENGE_FAILED",
            message: safeError.message
          }
        },
        circleTransactionFailureStatus(safeError.status)
      );
    }
  };

  const hardTimeout = createCreatePoolTransactionTimeoutPromise();

  try {
    return await Promise.race([route(), hardTimeout.promise]);
  } catch (error) {
    if (error instanceof CreatePoolTransactionTimeoutError) {
      return c.json({ data: null, error: createPoolTransactionTimeoutMessage }, 504);
    }

    if (error instanceof JsonRouteError) {
      return c.json({ data: null, error: error.error }, error.status);
    }

    const safeError = getSafeCircleError(error);
    console.warn("[Circle create transaction]", {
      status: safeError.status,
      category: "error"
    });

    return c.json(
      {
        data: null,
        error: {
          code: safeError.code ?? "CIRCLE_TRANSACTION_CHALLENGE_FAILED",
          message: safeError.message
        }
      },
      circleTransactionFailureStatus(safeError.status)
    );
  } finally {
    hardTimeout.clear();
  }
});

walletsRoutes.post("/wallets/me/pools/finalize-transaction", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = finalizePoolTransactionSchema.safeParse(json);
  const userToken = getBearerUserToken(c);

  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400);
  }

  if (!userToken) {
    return c.json({ data: null, error: "Circle user token is required." }, 401);
  }

  try {
    const transaction = await finalizeCircleUserControlledTransaction({
      userToken,
      challengeId: parsed.data.challengeId
    });

    console.info("[Circle transaction debug] createPool finalize", {
      challengeIdLength: parsed.data.challengeId.length,
      callbackFired: true,
      callbackStatus: transaction.challengeStatus,
      hasTransactionId: Boolean(transaction.transactionId),
      transactionIdLength: transaction.transactionId?.length ?? null,
      hasTxHash: Boolean(transaction.transactionHash),
      txHashLength: transaction.transactionHash?.length ?? null
    });

    let poolMetadata = null;

    if (transaction.transactionHash && transaction.status !== "TRANSACTION_FAILED") {
      const receipt = await getCreatedPoolIdFromReceipt(transaction.transactionHash);

      if (!receipt.confirmed) {
        return c.json({
          data: {
            transaction: {
              ...transaction,
              status: "TRANSACTION_FAILED",
              message: "The pool creation transaction was rejected on-chain."
            },
            poolMetadata: null
          },
          error: null
        });
      }

      if (receipt.onchainPoolId === null) {
        return c.json({
          data: {
            transaction: {
              ...transaction,
              status: "TRANSACTION_CONFIRMED",
              message: "Transaction confirmed, but the PoolCreated event was not found."
            },
            poolMetadata: null
          },
          error: null
        });
      }

      poolMetadata = await createPoolMetadata({
        chainId: env.ARC_TESTNET_CHAIN_ID,
        contractAddress: rotatingSavingsPoolAddress,
        onchainPoolId: receipt.onchainPoolId,
        title: parsed.data.title,
        description: parsed.data.description,
        createdTxHash: transaction.transactionHash
      });

      transaction.status = "TRANSACTION_CONFIRMED";
      transaction.message = "Pool creation transaction confirmed and metadata stored.";
    }

    return c.json({
      data: {
        transaction,
        poolMetadata
      },
      error: null
    });
  } catch (error) {
    const safeError = getSafeCircleError(error);
    console.warn("[Circle transaction debug] createPool finalize failed", {
      challengeIdLength: parsed.data.challengeId.length,
      callbackFired: true,
      circleErrorCode: safeError.code,
      circleErrorMessage: safeError.message
    });

    return c.json(
      {
        data: null,
        error: {
          code: safeError.code ?? "CIRCLE_TRANSACTION_FINALIZATION_FAILED",
          message: safeError.message
        }
      },
      circleTransactionFailureStatus(safeError.status)
    );
  }
});

walletsRoutes.post("/wallets/me/pools/:poolId/approve-transaction", async (c) => {
  const userToken = getBearerUserToken(c);
  const poolId = c.req.param("poolId");

  if (!userToken) {
    return c.json({ data: null, error: "Circle user token is required." }, 401);
  }

  let walletIdLength: number | null = null;
  let walletAddressPresent: boolean | null = null;

  try {
    const [pool, wallet] = await Promise.all([getPoolById(poolId), getUserWallet(userToken)]);
    walletIdLength = wallet.walletId?.length ?? null;
    walletAddressPresent = Boolean(wallet.address);

    if (!pool) {
      return c.json({ data: null, error: "Pool metadata not found." }, 404);
    }

    if (!wallet.walletId || !wallet.address) {
      return c.json({ data: null, error: "Create or complete a Circle wallet first." }, 400);
    }

    console.info("[Circle transaction debug] pool approve challenge request", {
      walletIdLength,
      addressPresent: walletAddressPresent,
      poolId: pool.onchainPoolId,
      functionSignature: approveFunctionSignature,
      abiParameterCount: approveAbiParameterCount
    });

    const transaction = await createCircleContractExecutionTransaction({
      userToken,
      walletId: wallet.walletId,
      contractAddress: pool.tokenAddress as Address,
      functionSignature: approveFunctionSignature,
      abiParameters: [rotatingSavingsPoolAddress, pool.contributionAmount],
      message: getPoolActionMessage("approve")
    });

    return c.json({
      data: {
        pool,
        transaction,
        action: "approve"
      },
      error: null
    });
  } catch (error) {
    const safeError = getSafeCircleError(error);
    console.warn("[Circle transaction debug] pool approve challenge failed", {
      walletIdLength,
      addressPresent: walletAddressPresent,
      poolId,
      functionSignature: approveFunctionSignature,
      abiParameterCount: approveAbiParameterCount,
      circleErrorCode: safeError.code,
      circleErrorMessage: safeError.message
    });

    return c.json(
      {
        data: null,
        error: {
          code: safeError.code ?? "CIRCLE_POOL_APPROVE_CHALLENGE_FAILED",
          message: safeError.message
        }
      },
      poolActionFailureStatus(safeError.status)
    );
  }
});

walletsRoutes.post("/wallets/me/pools/:poolId/join-transaction", async (c) => {
  const userToken = getBearerUserToken(c);
  const poolId = c.req.param("poolId");

  if (!userToken) {
    return c.json({ data: null, error: "Circle user token is required." }, 401);
  }

  let walletIdLength: number | null = null;
  let walletAddressPresent: boolean | null = null;
  let onchainPoolId: number | string = poolId;

  try {
    const [pool, wallet] = await Promise.all([getPoolById(poolId), getUserWallet(userToken)]);
    walletIdLength = wallet.walletId?.length ?? null;
    walletAddressPresent = Boolean(wallet.address);

    if (!pool) {
      return c.json({ data: null, error: "Pool metadata not found." }, 404);
    }
    onchainPoolId = pool.onchainPoolId;

    if (!wallet.walletId || !wallet.address) {
      return c.json({ data: null, error: "Create or complete a Circle wallet first." }, 400);
    }

    const [members, isMember] = await Promise.all([
      publicClient.readContract({
        abi: rotatingSavingsPoolAbi,
        address: rotatingSavingsPoolAddress,
        functionName: "getMembers",
        args: [BigInt(pool.onchainPoolId)]
      }),
      publicClient.readContract({
        abi: rotatingSavingsPoolAbi,
        address: rotatingSavingsPoolAddress,
        functionName: "isMember",
        args: [BigInt(pool.onchainPoolId), wallet.address]
      })
    ]);

    if (pool.status !== "created") {
      return c.json({ data: null, error: "This pool is not open for new members." }, 400);
    }

    if (isMember) {
      return c.json({ data: null, error: "This wallet has already joined the pool." }, 409);
    }

    if (members.length >= pool.maxMembers) {
      return c.json({ data: null, error: "This pool is full." }, 409);
    }

    console.info("[Circle transaction debug] pool join challenge request", {
      walletIdLength,
      addressPresent: walletAddressPresent,
      poolId: pool.onchainPoolId,
      functionSignature: joinPoolFunctionSignature,
      abiParameterCount: joinPoolAbiParameterCount
    });

    const transaction = await createCircleContractExecutionTransaction({
      userToken,
      walletId: wallet.walletId,
      contractAddress: rotatingSavingsPoolAddress,
      functionSignature: joinPoolFunctionSignature,
      abiParameters: [pool.onchainPoolId.toString()],
      message: getPoolActionMessage("join")
    });

    return c.json({
      data: {
        pool,
        transaction,
        action: "join"
      },
      error: null
    });
  } catch (error) {
    const safeError = getSafeCircleError(error);
    console.warn("[Circle transaction debug] pool join challenge failed", {
      walletIdLength,
      addressPresent: walletAddressPresent,
      poolId: onchainPoolId,
      functionSignature: joinPoolFunctionSignature,
      abiParameterCount: joinPoolAbiParameterCount,
      circleErrorCode: safeError.code,
      circleErrorMessage: safeError.message
    });

    return c.json(
      {
        data: null,
        error: {
          code: safeError.code ?? "CIRCLE_POOL_JOIN_CHALLENGE_FAILED",
          message: safeError.message
        }
      },
      poolActionFailureStatus(safeError.status)
    );
  }
});

walletsRoutes.post("/wallets/me/pools/:poolId/contribute-transaction", async (c) => {
  const userToken = getBearerUserToken(c);
  const poolId = c.req.param("poolId");

  if (!userToken) {
    return c.json({ data: null, error: "Circle user token is required." }, 401);
  }

  let walletIdLength: number | null = null;
  let walletAddressPresent: boolean | null = null;
  let onchainPoolId: number | string = poolId;

  try {
    const [pool, wallet] = await Promise.all([getPoolById(poolId), getUserWallet(userToken)]);
    walletIdLength = wallet.walletId?.length ?? null;
    walletAddressPresent = Boolean(wallet.address);

    if (!pool) {
      return c.json({ data: null, error: "Pool metadata not found." }, 404);
    }
    onchainPoolId = pool.onchainPoolId;

    if (!wallet.walletId || !wallet.address) {
      return c.json({ data: null, error: "Create or complete a Circle wallet first." }, 400);
    }

    if (pool.status !== "active") {
      return c.json({ data: null, error: "This pool is not active for contributions yet." }, 400);
    }

    const [isMember, hasContributed, balance, allowance] = await Promise.all([
      publicClient.readContract({
        abi: rotatingSavingsPoolAbi,
        address: rotatingSavingsPoolAddress,
        functionName: "isMember",
        args: [BigInt(pool.onchainPoolId), wallet.address]
      }),
      publicClient.readContract({
        abi: rotatingSavingsPoolAbi,
        address: rotatingSavingsPoolAddress,
        functionName: "hasContributed",
        args: [BigInt(pool.onchainPoolId), BigInt(pool.currentRound), wallet.address]
      }),
      publicClient.readContract({
        abi: erc20Abi,
        address: pool.tokenAddress as Address,
        functionName: "balanceOf",
        args: [wallet.address]
      }),
      publicClient.readContract({
        abi: erc20Abi,
        address: pool.tokenAddress as Address,
        functionName: "allowance",
        args: [wallet.address, rotatingSavingsPoolAddress]
      })
    ]);
    const requiredAmount = BigInt(pool.contributionAmount);

    if (!isMember) {
      return c.json({ data: null, error: "This wallet has not joined the pool." }, 400);
    }

    if (hasContributed) {
      return c.json({ data: null, error: "This wallet already contributed for the current round." }, 409);
    }

    if (balance < requiredAmount) {
      return c.json({ data: null, error: "Insufficient USDC balance for this contribution." }, 400);
    }

    if (allowance < requiredAmount) {
      return c.json(
        {
          data: null,
          error: {
            code: "INSUFFICIENT_ALLOWANCE",
            message: "Approve USDC before contributing to this pool."
          }
        },
        400
      );
    }

    console.info("[Circle transaction debug] pool contribute challenge request", {
      walletIdLength,
      addressPresent: walletAddressPresent,
      poolId: pool.onchainPoolId,
      functionSignature: contributeFunctionSignature,
      abiParameterCount: contributeAbiParameterCount
    });

    const transaction = await createCircleContractExecutionTransaction({
      userToken,
      walletId: wallet.walletId,
      contractAddress: rotatingSavingsPoolAddress,
      functionSignature: contributeFunctionSignature,
      abiParameters: [pool.onchainPoolId.toString()],
      message: getPoolActionMessage("contribute")
    });

    return c.json({
      data: {
        pool,
        transaction,
        action: "contribute"
      },
      error: null
    });
  } catch (error) {
    const safeError = getSafeCircleError(error);
    console.warn("[Circle transaction debug] pool contribute challenge failed", {
      walletIdLength,
      addressPresent: walletAddressPresent,
      poolId: onchainPoolId,
      functionSignature: contributeFunctionSignature,
      abiParameterCount: contributeAbiParameterCount,
      circleErrorCode: safeError.code,
      circleErrorMessage: safeError.message
    });

    return c.json(
      {
        data: null,
        error: {
          code: safeError.code ?? "CIRCLE_POOL_CONTRIBUTE_CHALLENGE_FAILED",
          message: safeError.message
        }
      },
      poolActionFailureStatus(safeError.status)
    );
  }
});

walletsRoutes.post("/wallets/me/pools/:poolId/finalize-transaction", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = finalizePoolActionTransactionSchema.safeParse(json);
  const userToken = getBearerUserToken(c);
  const poolId = c.req.param("poolId");

  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400);
  }

  if (!userToken) {
    return c.json({ data: null, error: "Circle user token is required." }, 401);
  }

  try {
    const pool = await getPoolById(poolId);
    if (!pool) {
      return c.json({ data: null, error: "Pool metadata not found." }, 404);
    }

    const transaction = await finalizeCircleUserControlledTransaction({
      userToken,
      challengeId: parsed.data.challengeId
    });

    console.info("[Circle transaction debug] pool action finalize", {
      challengeIdLength: parsed.data.challengeId.length,
      callbackFired: true,
      callbackStatus: transaction.challengeStatus,
      hasTransactionId: Boolean(transaction.transactionId),
      transactionIdLength: transaction.transactionId?.length ?? null,
      hasTxHash: Boolean(transaction.transactionHash),
      txHashLength: transaction.transactionHash?.length ?? null,
      poolId: pool.onchainPoolId,
      functionSignature: getPoolActionSignature(parsed.data.action),
      abiParameterCount: getPoolActionAbiParameterCount(parsed.data.action)
    });

    if (!transaction.transactionHash || transaction.status === "TRANSACTION_FAILED") {
      return c.json({
        data: {
          transaction,
          pool: await refreshPoolFromChain(pool.id),
          action: parsed.data.action
        },
        error: null
      });
    }

    if (parsed.data.action === "approve") {
      const receipt = await waitForSuccessfulReceipt(transaction.transactionHash);
      transaction.status = receipt.confirmed ? "TRANSACTION_CONFIRMED" : "TRANSACTION_FAILED";
      transaction.message = receipt.confirmed
        ? "USDC approval confirmed."
        : "USDC approval transaction was rejected on-chain.";

      return c.json({
        data: {
          transaction,
          pool: await refreshPoolFromChain(pool.id),
          action: parsed.data.action
        },
        error: null
      });
    }

    const expectedEvent = parsed.data.action === "join" ? "MemberJoined" : "ContributionMade";
    const receipt = await getPoolEventsFromReceipt(transaction.transactionHash);
    const primaryEvent = receipt.events.find((event) => event.eventName === expectedEvent) ?? null;

    if (!receipt.confirmed) {
      transaction.status = "TRANSACTION_FAILED";
      transaction.message = "The pool transaction was rejected on-chain.";
    } else if (!primaryEvent) {
      transaction.status = "TRANSACTION_CONFIRMED";
      transaction.message = `Transaction confirmed, but ${expectedEvent} was not found.`;
    } else {
      for (const event of receipt.events) {
        if (event.eventName === "MemberJoined") {
          await recordMemberJoined({
            poolId: pool.id,
            chainId: pool.chainId,
            contractAddress: pool.contractAddress,
            onchainPoolId: pool.onchainPoolId,
            memberAddress: String(event.eventArgs.member),
            memberIndex: Number(event.eventArgs.memberIndex),
            txHash: transaction.transactionHash,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex
          });
        }

        if (event.eventName === "PoolStarted") {
          await recordPoolStarted({
            poolId: pool.id,
            chainId: pool.chainId,
            contractAddress: pool.contractAddress,
            onchainPoolId: pool.onchainPoolId,
            txHash: transaction.transactionHash,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex
          });
        }

        if (event.eventName === "ContributionMade") {
          await recordContributionMade({
            poolId: pool.id,
            chainId: pool.chainId,
            contractAddress: pool.contractAddress,
            onchainPoolId: pool.onchainPoolId,
            memberAddress: String(event.eventArgs.member),
            roundIndex: Number(event.eventArgs.round),
            amount: String(event.eventArgs.amount),
            txHash: transaction.transactionHash,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex
          });
        }

        if (event.eventName === "PayoutReleased") {
          await recordPayoutReleased({
            poolId: pool.id,
            chainId: pool.chainId,
            contractAddress: pool.contractAddress,
            onchainPoolId: pool.onchainPoolId,
            recipientAddress: String(event.eventArgs.recipient),
            roundIndex: Number(event.eventArgs.round),
            amount: String(event.eventArgs.amount),
            txHash: transaction.transactionHash,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex
          });
        }

        if (event.eventName === "PoolCompleted") {
          await recordPoolCompleted({
            poolId: pool.id,
            chainId: pool.chainId,
            contractAddress: pool.contractAddress,
            onchainPoolId: pool.onchainPoolId,
            txHash: transaction.transactionHash,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex
          });
        }
      }

      transaction.status = "TRANSACTION_CONFIRMED";
      transaction.message =
        parsed.data.action === "join"
          ? "Pool join transaction confirmed and pool state stored."
          : "Contribution transaction confirmed and pool state stored.";
    }

    return c.json({
      data: {
        transaction,
        pool: await refreshPoolFromChain(pool.id),
        action: parsed.data.action
      },
      error: null
    });
  } catch (error) {
    const safeError = getSafeCircleError(error);
    console.warn("[Circle transaction debug] pool action finalize failed", {
      challengeIdLength: parsed.success ? parsed.data.challengeId.length : null,
      callbackFired: true,
      poolId,
      functionSignature: parsed.success ? getPoolActionSignature(parsed.data.action) : null,
      abiParameterCount: parsed.success ? getPoolActionAbiParameterCount(parsed.data.action) : null,
      circleErrorCode: safeError.code,
      circleErrorMessage: safeError.message
    });

    return c.json(
      {
        data: null,
        error: {
          code: safeError.code ?? "CIRCLE_POOL_ACTION_FINALIZATION_FAILED",
          message: safeError.message
        }
      },
      poolActionFailureStatus(safeError.status)
    );
  }
});
