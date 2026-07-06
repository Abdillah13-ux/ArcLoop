import { Hono } from "hono";
import { z } from "zod";

import { env } from "../config/env";
import { runRotatingSavingsPoolIndexerOnce } from "../indexer/rotating-savings-pool-indexer";

export const indexerRoutes = new Hono();

const runOnceBodySchema = z
  .object({
    fromBlock: z.coerce.number().int().nonnegative().optional(),
    toBlock: z.coerce.number().int().nonnegative().optional()
  })
  .optional();

indexerRoutes.post("/indexer/run-once", async (c) => {
  if (env.INDEXER_ADMIN_TOKEN) {
    const authorization = c.req.header("authorization");
    if (authorization !== `Bearer ${env.INDEXER_ADMIN_TOKEN}`) {
      return c.json({ data: null, error: "Unauthorized" }, 401);
    }
  }

  const json = await c.req.json().catch(() => undefined);
  const parsed = runOnceBodySchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400);
  }

  const summary = await runRotatingSavingsPoolIndexerOnce(parsed.data ?? {});
  const warning = env.INDEXER_ADMIN_TOKEN
    ? undefined
    : "INDEXER_ADMIN_TOKEN is not configured; local run-once endpoint is unprotected.";

  return c.json({
    data: {
      ...summary,
      warning
    },
    error: null
  });
});
