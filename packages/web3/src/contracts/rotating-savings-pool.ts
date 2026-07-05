import type { Address } from "viem";

export const rotatingSavingsPoolContract = {
  address: (process.env.ARCLOOP_CONTRACT_ADDRESS ?? null) as Address | null,
  abi: []
} as const;
