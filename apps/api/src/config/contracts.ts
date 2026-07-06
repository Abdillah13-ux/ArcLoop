import { createPublicClient, http, type Address } from "viem";
import { defineChain } from "viem";
import { rotatingSavingsPoolAbi } from "@arcloop/web3";

import { env } from "./env";

export const arcTestnet = defineChain({
  id: env.ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "Arc Testnet Gas Token",
    symbol: "ARC",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [env.ARC_TESTNET_RPC_URL]
    }
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: env.ARC_TESTNET_EXPLORER_URL
    }
  },
  testnet: true
});

export const rotatingSavingsPoolAddress = env.ARCLOOP_CONTRACT_ADDRESS.toLowerCase() as Address;

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(env.ARC_TESTNET_RPC_URL)
});

export const rotatingSavingsPoolContract = {
  address: rotatingSavingsPoolAddress,
  abi: rotatingSavingsPoolAbi
} as const;
