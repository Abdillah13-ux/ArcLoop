import "dotenv/config";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";

const optionalEnvNumber = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().positive().optional()
);

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(8787),
  ARC_TESTNET_RPC_URL: z.string().optional(),
  ARC_TESTNET_CHAIN_ID: optionalEnvNumber,
  ARC_TESTNET_EXPLORER_URL: z.string().optional()
});

const env = envSchema.parse(process.env);

const app = new Hono();

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "arcloop-api"
  })
);

app.get("/version", (c) =>
  c.json({
    name: "arcloop-api",
    version: "0.1.0"
  })
);

app.get("/chains/arc-testnet", (c) =>
  c.json({
    name: "Arc Testnet",
    rpcUrl: env.ARC_TESTNET_RPC_URL ?? null,
    chainId: env.ARC_TESTNET_CHAIN_ID ?? null,
    explorerUrl: env.ARC_TESTNET_EXPLORER_URL ?? null
  })
);

serve(
  {
    fetch: app.fetch,
    port: env.API_PORT
  },
  (info) => {
    console.log(`ArcLoop API listening on http://localhost:${info.port}`);
  }
);

export { app };
