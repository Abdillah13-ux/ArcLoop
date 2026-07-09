import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

import { z } from "zod";

const envFiles = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile, override: false });
  }
}

const optionalEnvNumber = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().positive().optional()
);

const optionalEnvString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);

const optionalEnvBoolean = z.preprocess(
  (value) => (value === "" || value === undefined ? "false" : value),
  z
    .enum(["true", "false"])
    .transform((value) => value === "true")
);

const envUrl = (fallback: string) =>
  z.preprocess((value) => (value === "" ? undefined : value), z.string().url().default(fallback));

const envAddress = (fallback: string) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .default(fallback)
  );

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: optionalEnvString,
  ARC_TESTNET_RPC_URL: envUrl("https://rpc.testnet.arc.network"),
  ARC_TESTNET_CHAIN_ID: optionalEnvNumber.default(5042002),
  ARC_TESTNET_EXPLORER_URL: envUrl("https://testnet.arcscan.app"),
  ARCLOOP_CONTRACT_ADDRESS: envAddress("0xdb0177f58DC2dceB621CD47336C77d3498999a67"),
  USDC_TOKEN_ADDRESS: envAddress("0x3600000000000000000000000000000000000000"),
  CIRCLE_API_KEY: optionalEnvString,
  CIRCLE_ENTITY_SECRET: optionalEnvString,
  CIRCLE_APP_ID: optionalEnvString,
  CIRCLE_GOOGLE_CLIENT_ID: optionalEnvString,
  CIRCLE_GOOGLE_REDIRECT_URI: optionalEnvString,
  CIRCLE_WALLET_SET_ID: optionalEnvString,
  DEV_TRANSACTION_EXECUTOR_ENABLED: optionalEnvBoolean,
  DEV_TRANSACTION_EXECUTOR_PRIVATE_KEY: optionalEnvString,
  INDEXER_START_BLOCK: optionalEnvNumber.default(50359746),
  INDEXER_ADMIN_TOKEN: optionalEnvString
});

export const env = envSchema.parse(process.env);
