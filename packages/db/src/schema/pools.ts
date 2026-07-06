import {
  bigint,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const pools = pgTable(
  "pools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    contractAddress: text("contract_address").notNull(),
    onchainPoolId: integer("onchain_pool_id").notNull(),
    creatorAddress: text("creator_address").notNull(),
    tokenAddress: text("token_address").notNull(),
    contributionAmount: text("contribution_amount").notNull(),
    maxMembers: integer("max_members").notNull(),
    currentRound: integer("current_round").default(0).notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    inviteCode: text("invite_code").notNull().unique(),
    createdTxHash: text("created_tx_hash"),
    createdBlockNumber: bigint("created_block_number", { mode: "number" }),
    startedTxHash: text("started_tx_hash"),
    cancelledTxHash: text("cancelled_tx_hash"),
    completedTxHash: text("completed_tx_hash"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("pools_chain_contract_onchain_pool_id_unique").on(
      table.chainId,
      table.contractAddress,
      table.onchainPoolId
    )
  ]
);
