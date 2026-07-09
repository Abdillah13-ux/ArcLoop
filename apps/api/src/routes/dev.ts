import { Hono } from "hono";
import {
  createWalletClient,
  encodeFunctionData,
  http,
  parseUnits,
  type Address,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

import { rotatingSavingsPoolAbi } from "@arcloop/web3";

import { rotatingSavingsPoolAddress } from "../config/contracts";
import { env } from "../config/env";

export const devRoutes = new Hono();

const createPoolTransactionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  contributionAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,6})?$/, "Use a positive USDC amount with up to 6 decimals."),
  maxMembers: z.coerce.number().int().min(2).max(100)
});

const arcTestnet = {
  id: env.ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "ETH",
    symbol: "ETH"
  },
  rpcUrls: {
    default: {
      http: [env.ARC_TESTNET_RPC_URL]
    }
  }
} as const;

function getDevExecutorPrivateKey(): Hex | null {
  const privateKey = env.DEV_TRANSACTION_EXECUTOR_PRIVATE_KEY;

  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    return null;
  }

  return privateKey as Hex;
}

devRoutes.post("/dev/pools/create-transaction", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createPoolTransactionSchema.safeParse(json);

  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400);
  }

  if (!env.DEV_TRANSACTION_EXECUTOR_ENABLED) {
    return c.json(
      {
        data: null,
        error: {
          code: "DEV_EXECUTOR_NOT_CONFIGURED",
          message: "Dev transaction executor is disabled."
        }
      },
      403
    );
  }

  const privateKey = getDevExecutorPrivateKey();
  if (!privateKey) {
    return c.json(
      {
        data: null,
        error: {
          code: "DEV_EXECUTOR_NOT_CONFIGURED",
          message: "DEV_TRANSACTION_EXECUTOR_PRIVATE_KEY is required for dev transactions."
        }
      },
      503
    );
  }

  const contributionAmount = parseUnits(parsed.data.contributionAmount, 6);
  if (contributionAmount <= 0n) {
    return c.json({ data: null, error: "Contribution amount must be greater than zero." }, 400);
  }

  const calldata = encodeFunctionData({
    abi: rotatingSavingsPoolAbi,
    functionName: "createPool",
    args: [env.USDC_TOKEN_ADDRESS as Address, contributionAmount, BigInt(parsed.data.maxMembers)]
  });
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(env.ARC_TESTNET_RPC_URL)
  });

  try {
    const txHash = await walletClient.writeContract({
      address: rotatingSavingsPoolAddress,
      abi: rotatingSavingsPoolAbi,
      functionName: "createPool",
      args: [env.USDC_TOKEN_ADDRESS as Address, contributionAmount, BigInt(parsed.data.maxMembers)]
    });

    return c.json({
      data: {
        txHash,
        chainId: env.ARC_TESTNET_CHAIN_ID,
        contractAddress: rotatingSavingsPoolAddress,
        explorerUrl: env.ARC_TESTNET_EXPLORER_URL,
        calldata,
        status: "TRANSACTION_SUBMITTED"
      },
      error: null
    });
  } catch (error) {
    return c.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Unable to submit dev transaction."
      },
      502
    );
  }
});
