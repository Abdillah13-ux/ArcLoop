import type { Address } from "viem";

export const usdcToken = {
  symbol: "USDC",
  decimals: 6,
  address: (process.env.USDC_TOKEN_ADDRESS ?? null) as Address | null
};
