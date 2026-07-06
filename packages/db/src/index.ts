import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export * from "./schema";
export { schema };

export function createDb(databaseUrl: string) {
  const client = new Pool({
    connectionString: databaseUrl
  });

  return drizzle(client, { schema });
}
