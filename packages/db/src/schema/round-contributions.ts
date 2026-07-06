import { bigint, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { poolRounds } from "./pool-rounds";
import { pools } from "./pools";

export const roundContributions = pgTable(
  "round_contributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: uuid("pool_id")
      .references(() => pools.id)
      .notNull(),
    roundId: uuid("round_id").references(() => poolRounds.id),
    onchainPoolId: integer("onchain_pool_id").notNull(),
    roundIndex: integer("round_index").notNull(),
    memberAddress: text("member_address").notNull(),
    amount: text("amount").notNull(),
    txHash: text("tx_hash").notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    logIndex: integer("log_index").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("round_contributions_tx_log_unique").on(table.txHash, table.logIndex),
    uniqueIndex("round_contributions_pool_round_member_unique").on(
      table.poolId,
      table.roundIndex,
      table.memberAddress
    )
  ]
);
