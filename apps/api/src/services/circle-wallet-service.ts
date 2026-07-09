import {
  Blockchain,
  initiateUserControlledWalletsClient,
  type Wallet
} from "@circle-fin/user-controlled-wallets";
import { randomUUID } from "node:crypto";
import type { Address, Hex } from "viem";

import { env } from "../config/env";

export type WalletRuntimeState =
  | "CIRCLE_NOT_CONFIGURED"
  | "WALLET_NOT_CREATED"
  | "TRANSACTION_SUBMITTED"
  | "TRANSACTION_PENDING"
  | "TRANSACTION_CONFIRMED"
  | "TRANSACTION_FAILED"
  | "NOT_IMPLEMENTED";

export type SafeWalletMetadata = {
  walletId: string | null;
  address: Address | null;
  status: WalletRuntimeState;
};

export type WalletChallengeMetadata = {
  challengeId: string | null;
  status: WalletRuntimeState;
  wallet: SafeWalletMetadata;
};

export type PinSetupChallengeMetadata = {
  challengeId: string | null;
  status: WalletRuntimeState;
};

export type CircleSocialLoginConfig = {
  appId: string | null;
  googleClientId: string | null;
  googleRedirectUri: string | null;
  configured: boolean;
  requiredEnvVars: string[];
};

export type CircleSocialDeviceToken = CircleSocialLoginConfig & {
  deviceToken: string | null;
  deviceEncryptionKey: string | null;
};

export type CreateCircleTransactionInput = {
  userToken: string;
  walletId: string;
  to: Address;
  contributionAmount: string;
  maxMembers: number;
};

export type CreateCircleContractExecutionInput = {
  userToken: string;
  walletId: string;
  contractAddress: Address;
  functionSignature: string;
  abiParameters: Array<string | number | boolean | string[]>;
  message: string;
};

export type CircleTransactionResult = {
  challengeId: string | null;
  transactionId: string | null;
  transactionHash: Hex | null;
  status: WalletRuntimeState;
  message: string;
};

export type CircleTransactionFinalizationResult = {
  challengeStatus: string | null;
  challengeType: string | null;
  transactionId: string | null;
  transactionHash: Hex | null;
  transactionState: string | null;
  status: WalletRuntimeState;
  message: string;
};

export type SafeCircleError = {
  code: string | number | null;
  message: string;
  status: number | null;
};

const circleApiBaseUrl = "https://api.circle.com";
const circleSocialDeviceTokenTimeoutMs = 5_000;
const circleSocialDeviceTokenTimeoutMessage = "Circle social device token request timed out.";
export const circleSocialDeviceTokenHardTimeoutMs = 6_000;
const circleTransactionCreateTimeoutMs = 5_000;
const circleTransactionCreateTimeoutMessage = "Circle transaction creation request timed out.";
const circleStatusRequestTimeoutMs = 5_000;

export class CircleSocialDeviceTokenError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly category: "timeout" | "upstream" | "network" | "invalid_response"
  ) {
    super(message);
    this.name = "CircleSocialDeviceTokenError";
  }
}

export class CircleTransactionRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly category: "timeout" | "upstream" | "network" | "invalid_response"
  ) {
    super(message);
    this.name = "CircleTransactionRequestError";
  }
}

export const createPoolFunctionSignature = "createPool(address,uint256,uint256)";
export const createPoolAbiParameterCount = 3;
export const joinPoolFunctionSignature = "joinPool(uint256)";
export const joinPoolAbiParameterCount = 1;
export const contributeFunctionSignature = "contribute(uint256)";
export const contributeAbiParameterCount = 1;
export const approveFunctionSignature = "approve(address,uint256)";
export const approveAbiParameterCount = 2;

function hasServerConfig() {
  return Boolean(env.CIRCLE_API_KEY);
}

function hasSocialLoginConfig() {
  return Boolean(env.CIRCLE_API_KEY && env.CIRCLE_APP_ID && env.CIRCLE_GOOGLE_CLIENT_ID);
}

function getClient() {
  if (!env.CIRCLE_API_KEY) {
    return null;
  }

  return initiateUserControlledWalletsClient({
    apiKey: env.CIRCLE_API_KEY
  });
}

function getCircleErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as {
    message?: unknown;
    error?: unknown;
    errors?: unknown;
  };

  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message;
  }

  if (typeof candidate.error === "string" && candidate.error.trim()) {
    return candidate.error;
  }

  if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
    const firstError = candidate.errors[0] as { message?: unknown } | undefined;
    if (typeof firstError?.message === "string" && firstError.message.trim()) {
      return firstError.message;
    }
  }

  return null;
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function logCircleSocialDeviceTokenResult(details: {
  status: number | null;
  category: "start" | "response" | "success" | CircleSocialDeviceTokenError["category"];
}) {
  console.info("[Circle social device token]", details);
}

function logCircleTransactionResult(details: {
  status: number | null;
  category: "timeout" | "response";
}) {
  console.info("[Circle transaction]", details);
}

function asAddress(value: unknown): Address | null {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? (value as Address)
    : null;
}

function getWalletAddress(wallet: Wallet | null | undefined) {
  const candidate = wallet as
    | (Wallet & {
        address?: unknown;
        accountAddress?: unknown;
      })
    | null
    | undefined;

  return asAddress(candidate?.address) ?? asAddress(candidate?.accountAddress) ?? null;
}

function getChallengeId(response: unknown) {
  const candidate = response as { challengeId?: unknown } | undefined;
  return typeof candidate?.challengeId === "string" ? candidate.challengeId : null;
}

function getFirstString(values: unknown) {
  return Array.isArray(values) && typeof values[0] === "string" ? values[0] : null;
}

function getCircleChallengeDetails(response: unknown) {
  const challenge = (
    response as
      | {
          challenge?: unknown;
        }
      | undefined
  )?.challenge as
    | {
        status?: unknown;
        type?: unknown;
        correlationIds?: unknown;
      }
    | undefined;

  return {
    challengeStatus: typeof challenge?.status === "string" ? challenge.status : null,
    challengeType: typeof challenge?.type === "string" ? challenge.type : null,
    transactionId: getFirstString(challenge?.correlationIds)
  };
}

function getTransactionHash(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value) ? (value as Hex) : null;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function mapCircleTransactionState(state: string | null, transactionHash: Hex | null) {
  if (state === "CONFIRMED" || state === "COMPLETE") {
    return "TRANSACTION_CONFIRMED";
  }

  if (state === "FAILED" || state === "DENIED" || state === "CANCELLED") {
    return "TRANSACTION_FAILED";
  }

  return transactionHash ? "TRANSACTION_SUBMITTED" : "TRANSACTION_PENDING";
}

function getCircleTransactionDetails(response: unknown) {
  const transaction = (
    response as
      | {
          transaction?: unknown;
        }
      | undefined
  )?.transaction as
    | {
        id?: unknown;
        state?: unknown;
        txHash?: unknown;
      }
    | undefined;

  return {
    transactionId: typeof transaction?.id === "string" ? transaction.id : null,
    transactionState: typeof transaction?.state === "string" ? transaction.state : null,
    transactionHash: getTransactionHash(transaction?.txHash)
  };
}

async function withCircleStatusTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new CircleTransactionRequestError(message, null, "timeout"));
    }, circleStatusRequestTimeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export function getSafeCircleError(error: unknown): SafeCircleError {
  const candidate = error as
    | {
        code?: unknown;
        message?: unknown;
        status?: unknown;
      }
    | undefined;

  return {
    code:
      typeof candidate?.code === "string" || typeof candidate?.code === "number"
        ? candidate.code
        : null,
    message:
      typeof candidate?.message === "string" && candidate.message.trim()
        ? candidate.message
        : "Circle transaction challenge failed.",
    status: typeof candidate?.status === "number" ? candidate.status : null
  };
}

function safeWallet(wallet: Wallet | null | undefined): SafeWalletMetadata {
  if (!wallet) {
    return {
      walletId: null,
      address: null,
      status: "WALLET_NOT_CREATED"
    };
  }

  return {
    walletId: typeof wallet.id === "string" ? wallet.id : null,
    address: getWalletAddress(wallet),
    status: "TRANSACTION_CONFIRMED"
  };
}

export function getCircleConfigurationStatus(): CircleSocialLoginConfig {
  return {
    appId: env.CIRCLE_APP_ID ?? null,
    googleClientId: env.CIRCLE_GOOGLE_CLIENT_ID ?? null,
    googleRedirectUri: env.CIRCLE_GOOGLE_REDIRECT_URI ?? null,
    configured: hasSocialLoginConfig(),
    requiredEnvVars: ["CIRCLE_API_KEY", "CIRCLE_APP_ID", "CIRCLE_GOOGLE_CLIENT_ID"]
  };
}

export async function createSocialLoginDeviceToken(
  deviceId: string
): Promise<CircleSocialDeviceToken> {
  const config = getCircleConfigurationStatus();

  if (!env.CIRCLE_API_KEY || !hasSocialLoginConfig()) {
    return {
      ...config,
      deviceToken: null,
      deviceEncryptionKey: null
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, circleSocialDeviceTokenTimeoutMs);

  let response: Response;

  try {
    logCircleSocialDeviceTokenResult({
      status: null,
      category: "start"
    });

    response = await fetch(`${circleApiBaseUrl}/v1/w3s/users/social/token`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.CIRCLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        deviceId
      })
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const category = isTimeout ? "timeout" : "network";

    logCircleSocialDeviceTokenResult({
      status: null,
      category
    });

    throw new CircleSocialDeviceTokenError(
      isTimeout ? circleSocialDeviceTokenTimeoutMessage : "Unable to reach Circle social device token endpoint.",
      null,
      category
    );
  } finally {
    clearTimeout(timeout);
  }

  logCircleSocialDeviceTokenResult({
    status: response.status,
    category: "response"
  });

  const payload = await readJsonResponse(response);

  if (!response.ok) {
    logCircleSocialDeviceTokenResult({
      status: response.status,
      category: "upstream"
    });

    throw new CircleSocialDeviceTokenError(
      getCircleErrorMessage(payload) ?? "Circle social device token request failed.",
      response.status,
      "upstream"
    );
  }

  const data = (payload as { data?: unknown } | null)?.data as
    | {
        deviceToken?: string;
        deviceEncryptionKey?: string;
      }
    | undefined;

  if (!data?.deviceToken || !data.deviceEncryptionKey) {
    logCircleSocialDeviceTokenResult({
      status: response.status,
      category: "invalid_response"
    });

    throw new CircleSocialDeviceTokenError(
      "Circle social device token response was missing required fields.",
      response.status,
      "invalid_response"
    );
  }

  logCircleSocialDeviceTokenResult({
    status: response.status,
    category: "success"
  });

  return {
    ...config,
    deviceToken: data.deviceToken,
    deviceEncryptionKey: data.deviceEncryptionKey
  };
}

export async function getUserWallet(userToken: string): Promise<SafeWalletMetadata> {
  const client = getClient();
  if (!client || !hasServerConfig()) {
    return {
      walletId: null,
      address: null,
      status: "CIRCLE_NOT_CONFIGURED"
    };
  }

  const response = await client.listWallets({
    userToken,
    blockchain: Blockchain.ArcTestnet
  });
  const wallet = response.data?.wallets?.[0] ?? null;

  return safeWallet(wallet);
}

export async function createUserWallet(userToken: string): Promise<WalletChallengeMetadata> {
  const client = getClient();
  if (!client || !hasServerConfig()) {
    return {
      challengeId: null,
      status: "CIRCLE_NOT_CONFIGURED",
      wallet: {
        walletId: null,
        address: null,
        status: "CIRCLE_NOT_CONFIGURED"
      }
    };
  }

  const existingWallet = await getUserWallet(userToken);
  if (existingWallet.walletId) {
    return {
      challengeId: null,
      status: "TRANSACTION_CONFIRMED",
      wallet: existingWallet
    };
  }

  const response = await client.createWallet({
    userToken,
    blockchains: [Blockchain.ArcTestnet]
  });

  return {
    challengeId: getChallengeId(response.data),
    status: "TRANSACTION_PENDING",
    wallet: existingWallet
  };
}

export async function createUserPinSetupChallenge(
  userToken: string
): Promise<PinSetupChallengeMetadata> {
  const client = getClient();
  if (!client || !hasServerConfig()) {
    return {
      challengeId: null,
      status: "CIRCLE_NOT_CONFIGURED"
    };
  }

  const response = await client.createUserPin({
    userToken,
    idempotencyKey: randomUUID()
  });

  return {
    challengeId: getChallengeId(response.data),
    status: "TRANSACTION_PENDING"
  };
}

export async function createCircleUserControlledTransaction(
  input: CreateCircleTransactionInput
): Promise<CircleTransactionResult> {
  return createCircleContractExecutionTransaction({
    userToken: input.userToken,
    walletId: input.walletId,
    contractAddress: input.to,
    functionSignature: createPoolFunctionSignature,
    abiParameters: [
      env.USDC_TOKEN_ADDRESS.toLowerCase(),
      input.contributionAmount,
      input.maxMembers.toString()
    ],
    message: "Circle returned a user approval challenge for the createPool transaction."
  });
}

export async function createCircleContractExecutionTransaction(
  input: CreateCircleContractExecutionInput
): Promise<CircleTransactionResult> {
  const client = getClient();
  if (!client || !hasServerConfig()) {
    return {
      challengeId: null,
      transactionId: null,
      transactionHash: null,
      status: "CIRCLE_NOT_CONFIGURED",
      message: "Circle User-Controlled Wallet execution is not configured on the API server."
    };
  }

  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      logCircleTransactionResult({
        status: null,
        category: "timeout"
      });
      reject(new CircleTransactionRequestError(circleTransactionCreateTimeoutMessage, null, "timeout"));
    }, circleTransactionCreateTimeoutMs);
  });

  const response = await Promise.race([
    client.createUserTransactionContractExecutionChallenge({
      userToken: input.userToken,
      walletId: input.walletId,
      contractAddress: input.contractAddress,
      abiFunctionSignature: input.functionSignature,
      abiParameters: input.abiParameters,
      fee: {
        type: "level",
        config: {
          feeLevel: "HIGH"
        }
      }
    }),
    timeoutPromise
  ]).finally(() => clearTimeout(timeoutId));

  logCircleTransactionResult({
    status: typeof response.status === "number" ? response.status : null,
    category: "response"
  });

  const data = response.data as
    | {
        challengeId?: string;
        transactionId?: string;
      }
    | undefined;

  return {
    challengeId: data?.challengeId ?? null,
    transactionId: data?.transactionId ?? null,
    transactionHash: null,
    status: "TRANSACTION_PENDING",
    message: input.message
  };
}

export async function finalizeCircleUserControlledTransaction(input: {
  userToken: string;
  challengeId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<CircleTransactionFinalizationResult> {
  const client = getClient();
  if (!client || !hasServerConfig()) {
    return {
      challengeStatus: null,
      challengeType: null,
      transactionId: null,
      transactionHash: null,
      transactionState: null,
      status: "CIRCLE_NOT_CONFIGURED",
      message: "Circle User-Controlled Wallet execution is not configured on the API server."
    };
  }

  const deadline = Date.now() + (input.timeoutMs ?? 60_000);
  const pollInterval = input.pollIntervalMs ?? 3_000;
  let challengeStatus: string | null = null;
  let challengeType: string | null = null;
  let transactionId: string | null = null;

  while (Date.now() <= deadline) {
    const challengeResponse = await withCircleStatusTimeout(
      client.getUserChallenge({
        userToken: input.userToken,
        challengeId: input.challengeId
      }),
      "Circle challenge status request timed out."
    );
    const details = getCircleChallengeDetails(challengeResponse.data);
    challengeStatus = details.challengeStatus;
    challengeType = details.challengeType;
    transactionId = details.transactionId;

    if (challengeStatus === "FAILED" || challengeStatus === "EXPIRED" || transactionId) {
      break;
    }

    await delay(pollInterval);
  }

  if (challengeStatus === "FAILED" || challengeStatus === "EXPIRED") {
    return {
      challengeStatus,
      challengeType,
      transactionId,
      transactionHash: null,
      transactionState: null,
      status: "TRANSACTION_FAILED",
      message: `Circle transaction challenge ${challengeStatus.toLowerCase()}.`
    };
  }

  if (!transactionId) {
    return {
      challengeStatus,
      challengeType,
      transactionId: null,
      transactionHash: null,
      transactionState: null,
      status: "TRANSACTION_PENDING",
      message: "Timed out waiting for Circle to create the transaction after challenge completion."
    };
  }

  let latest = {
    transactionId,
    transactionState: null as string | null,
    transactionHash: null as Hex | null
  };

  while (Date.now() <= deadline) {
    const transactionResponse = await withCircleStatusTimeout(
      client.getTransaction({
        userToken: input.userToken,
        id: transactionId
      }),
      "Circle transaction status request timed out."
    );
    const details = getCircleTransactionDetails(transactionResponse.data);
    latest = {
      transactionId: details.transactionId ?? transactionId,
      transactionState: details.transactionState,
      transactionHash: details.transactionHash
    };
    const status = mapCircleTransactionState(latest.transactionState, latest.transactionHash);

    if (status === "TRANSACTION_CONFIRMED" || status === "TRANSACTION_FAILED" || latest.transactionHash) {
      return {
        challengeStatus,
        challengeType,
        transactionId: latest.transactionId,
        transactionHash: latest.transactionHash,
        transactionState: latest.transactionState,
        status,
        message:
          status === "TRANSACTION_FAILED"
            ? "Circle transaction failed."
            : latest.transactionHash
              ? "Circle transaction was submitted to the network."
              : "Circle transaction is confirmed."
      };
    }

    await delay(pollInterval);
  }

  return {
    challengeStatus,
    challengeType,
    transactionId: latest.transactionId,
    transactionHash: latest.transactionHash,
    transactionState: latest.transactionState,
    status: mapCircleTransactionState(latest.transactionState, latest.transactionHash),
    message: "Timed out waiting for Circle to submit the transaction."
  };
}
