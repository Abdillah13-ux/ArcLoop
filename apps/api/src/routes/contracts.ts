import { Hono } from "hono";

import { env } from "../config/env";
import { rotatingSavingsPoolAddress } from "../config/contracts";

export const contractsRoutes = new Hono();

contractsRoutes.get("/contracts/rotating-savings-pool", (c) =>
  c.json({
    data: {
      chainId: env.ARC_TESTNET_CHAIN_ID,
      address: rotatingSavingsPoolAddress,
      explorerUrl: env.ARC_TESTNET_EXPLORER_URL,
      usdcTokenAddress: env.USDC_TOKEN_ADDRESS.toLowerCase()
    },
    error: null
  })
);
