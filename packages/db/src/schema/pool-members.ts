import {
  bigint,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { pools } from "./pools";

export const poolMembers = pgTable(
  "pool_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: uuid("pool_id")
      .references(() => pools.id)
      .notNull(),
    chainId: integer("chain_id").notNull(),
    contractAddress: text("contract_address").notNull(),
    onchainPoolId: integer("onchain_pool_id").notNull(),
    memberAddress: text("member_address").notNull(),
    memberIndex: integer("member_index").notNull(),
    joinedTxHash: text("joined_tx_hash"),
    joinedBlockNumber: bigint("joined_block_number", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("pool_members_chain_contract_pool_member_unique").on(
      table.chainId,
      table.contractAddress,
      table.onchainPoolId,
      table.memberAddress
    ),
    uniqueIndex("pool_members_chain_contract_pool_index_unique").on(
      table.chainId,
      table.contractAddress,
      table.onchainPoolId,
      table.memberIndex
    )
  ]
);
