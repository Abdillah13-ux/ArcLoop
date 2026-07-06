import { bigint, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { pools } from "./pools";

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: uuid("pool_id")
      .references(() => pools.id)
      .notNull(),
    onchainPoolId: integer("onchain_pool_id").notNull(),
    roundIndex: integer("round_index").notNull(),
    recipientAddress: text("recipient_address").notNull(),
    amount: text("amount").notNull(),
    txHash: text("tx_hash").notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    logIndex: integer("log_index").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("payouts_tx_log_unique").on(table.txHash, table.logIndex),
    uniqueIndex("payouts_pool_round_unique").on(table.poolId, table.roundIndex)
  ]
);
