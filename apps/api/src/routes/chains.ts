import { Hono } from "hono";
import { z } from "zod";

import { env } from "../config/env";
import { getPoolByOnchainId } from "../services/pool-service";

export const chainsRoutes = new Hono();

chainsRoutes.get("/chains/arc-testnet", (c) =>
  c.json({
    data: {
      name: "Arc Testnet",
      rpcUrl: env.ARC_TESTNET_RPC_URL,
      chainId: env.ARC_TESTNET_CHAIN_ID,
      explorerUrl: env.ARC_TESTNET_EXPLORER_URL
    },
    error: null
  })
);

const onchainPoolParamsSchema = z.object({
  chainId: z.coerce.number().int().positive(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  onchainPoolId: z.coerce.number().int().nonnegative()
});

chainsRoutes.get(
  "/chains/:chainId/contracts/:contractAddress/pools/:onchainPoolId",
  async (c) => {
    const parsed = onchainPoolParamsSchema.safeParse(c.req.param());
    if (!parsed.success) {
      return c.json({ data: null, error: parsed.error.flatten() }, 400);
    }

    const pool = await getPoolByOnchainId(
      parsed.data.chainId,
      parsed.data.contractAddress,
      parsed.data.onchainPoolId
    );

    if (!pool) {
      return c.json({ data: null, error: "Pool metadata not found" }, 404);
    }

    return c.json({ data: pool, error: null });
  }
);
