CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"contract_address" text NOT NULL,
	"onchain_pool_id" integer NOT NULL,
	"creator_address" text NOT NULL,
	"token_address" text NOT NULL,
	"contribution_amount" text NOT NULL,
	"max_members" integer NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"invite_code" text NOT NULL,
	"created_tx_hash" text,
	"created_block_number" bigint,
	"started_tx_hash" text,
	"cancelled_tx_hash" text,
	"completed_tx_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pools_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pool_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"chain_id" integer NOT NULL,
	"contract_address" text NOT NULL,
	"onchain_pool_id" integer NOT NULL,
	"member_address" text NOT NULL,
	"member_index" integer NOT NULL,
	"joined_tx_hash" text,
	"joined_block_number" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pool_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"onchain_pool_id" integer NOT NULL,
	"round_index" integer NOT NULL,
	"recipient_address" text NOT NULL,
	"contribution_count" integer DEFAULT 0 NOT NULL,
	"payout_amount" text NOT NULL,
	"paid_out" boolean DEFAULT false NOT NULL,
	"payout_tx_hash" text,
	"payout_block_number" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "round_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"round_id" uuid,
	"onchain_pool_id" integer NOT NULL,
	"round_index" integer NOT NULL,
	"member_address" text NOT NULL,
	"amount" text NOT NULL,
	"tx_hash" text NOT NULL,
	"block_number" bigint NOT NULL,
	"log_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"onchain_pool_id" integer NOT NULL,
	"round_index" integer NOT NULL,
	"recipient_address" text NOT NULL,
	"amount" text NOT NULL,
	"tx_hash" text NOT NULL,
	"block_number" bigint NOT NULL,
	"log_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "indexed_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"contract_address" text NOT NULL,
	"event_name" text NOT NULL,
	"tx_hash" text NOT NULL,
	"block_number" bigint NOT NULL,
	"log_index" integer NOT NULL,
	"payload_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "indexer_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"contract_address" text NOT NULL,
	"last_indexed_block" bigint NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_rounds" ADD CONSTRAINT "pool_rounds_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "round_contributions" ADD CONSTRAINT "round_contributions_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "round_contributions" ADD CONSTRAINT "round_contributions_round_id_pool_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."pool_rounds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pools_chain_contract_onchain_pool_id_unique" ON "pools" USING btree ("chain_id","contract_address","onchain_pool_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pool_members_chain_contract_pool_member_unique" ON "pool_members" USING btree ("chain_id","contract_address","onchain_pool_id","member_address");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pool_members_chain_contract_pool_index_unique" ON "pool_members" USING btree ("chain_id","contract_address","onchain_pool_id","member_index");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pool_rounds_pool_round_index_unique" ON "pool_rounds" USING btree ("pool_id","round_index");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "round_contributions_tx_log_unique" ON "round_contributions" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "round_contributions_pool_round_member_unique" ON "round_contributions" USING btree ("pool_id","round_index","member_address");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payouts_tx_log_unique" ON "payouts" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payouts_pool_round_unique" ON "payouts" USING btree ("pool_id","round_index");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "indexed_events_chain_contract_tx_log_unique" ON "indexed_events" USING btree ("chain_id","contract_address","tx_hash","log_index");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "indexer_state_chain_contract_unique" ON "indexer_state" USING btree ("chain_id","contract_address");
