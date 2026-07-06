import { Hono } from "hono";
import { z } from "zod";

import { getPoolByInviteCode } from "../services/pool-service";

export const invitesRoutes = new Hono();

const inviteParamsSchema = z.object({
  inviteCode: z.string().min(1).max(32)
});

invitesRoutes.get("/invites/:inviteCode", async (c) => {
  const parsed = inviteParamsSchema.safeParse(c.req.param());
  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400);
  }

  const pool = await getPoolByInviteCode(parsed.data.inviteCode);
  if (!pool) {
    return c.json({ data: null, error: "Invite not found" }, 404);
  }

  return c.json({ data: pool, error: null });
});
