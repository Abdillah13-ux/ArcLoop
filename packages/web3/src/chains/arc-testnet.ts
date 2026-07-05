import { defineChain } from "viem";

const chainId = Number(process.env.ARC_TESTNET_CHAIN_ID ?? 0);
const rpcUrl = process.env.ARC_TESTNET_RPC_URL;
const explorerUrl = process.env.ARC_TESTNET_EXPLORER_URL;

export const arcTestnet = defineChain({
  id: chainId,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "Arc Testnet Gas Token",
    symbol: "ARC",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: rpcUrl ? [rpcUrl] : []
    }
  },
  blockExplorers: explorerUrl
    ? {
        default: {
          name: "Arc Testnet Explorer",
          url: explorerUrl
        }
      }
    : undefined,
  testnet: true
});
