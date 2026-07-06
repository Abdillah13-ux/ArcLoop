import {
  bigint,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { pools } from "./pools";

export const poolRounds = pgTable(
  "pool_rounds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: uuid("pool_id")
      .references(() => pools.id)
      .notNull(),
    onchainPoolId: integer("onchain_pool_id").notNull(),
    roundIndex: integer("round_index").notNull(),
    recipientAddress: text("recipient_address").notNull(),
    contributionCount: integer("contribution_count").default(0).notNull(),
    payoutAmount: text("payout_amount").notNull(),
    paidOut: boolean("paid_out").default(false).notNull(),
    payoutTxHash: text("payout_tx_hash"),
    payoutBlockNumber: bigint("payout_block_number", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("pool_rounds_pool_round_index_unique").on(table.poolId, table.roundIndex)
  ]
);
