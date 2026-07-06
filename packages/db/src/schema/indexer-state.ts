import { bigint, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const indexerState = pgTable(
  "indexer_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    contractAddress: text("contract_address").notNull(),
    lastIndexedBlock: bigint("last_indexed_block", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("indexer_state_chain_contract_unique").on(table.chainId, table.contractAddress)
  ]
);
