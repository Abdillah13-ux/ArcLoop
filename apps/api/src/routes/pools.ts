import { Hono } from "hono";
import { z } from "zod";

import {
  createPoolMetadata,
  getPoolById,
  listPools
} from "../services/pool-service";

export const poolsRoutes = new Hono();

const createPoolSchema = z.object({
  chainId: z.coerce.number().int().positive(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  onchainPoolId: z.coerce.number().int().nonnegative(),
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  createdTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional()
});

const listPoolsSchema = z.object({
  creator: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  member: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  status: z.string().optional()
});

poolsRoutes.post("/pools", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createPoolSchema.safeParse(json);

  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await createPoolMetadata(parsed.data);
    return c.json({ data: result, error: null }, result.created ? 201 : 200);
  } catch (error) {
    return c.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Unable to create pool metadata"
      },
      400
    );
  }
});

poolsRoutes.get("/pools", async (c) => {
  const parsed = listPoolsSchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));

  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400);
  }

  const items = await listPools(parsed.data);
  return c.json({ data: items, error: null });
});

poolsRoutes.get("/pools/:id", async (c) => {
  const id = c.req.param("id");
  const pool = await getPoolById(id);

  if (!pool) {
    return c.json({ data: null, error: "Pool metadata not found" }, 404);
  }

  return c.json({ data: pool, error: null });
});
