import { createDb } from "@arcloop/db";

import { env } from "../config/env";

let cachedDb: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database-backed routes");
  }

  cachedDb ??= createDb(env.DATABASE_URL);
  return cachedDb;
}
