import { and, eq, type InferInsertModel } from "drizzle-orm";
import { poolMembers, pools } from "@arcloop/db";

import { publicClient, rotatingSavingsPoolContract } from "../config/contracts";
import { getDb } from "../db/client";

type PoolInsert = InferInsertModel<typeof pools>;

const poolStatuses = ["created", "active", "completed", "cancelled"] as const;

export type CreatePoolMetadataInput = {
  chainId: number;
  contractAddress: string;
  onchainPoolId: number;
  title: string;
  description?: string;
  createdTxHash?: string;
};

export type PoolFilters = {
  creator?: string;
  member?: string;
  status?: string;
};

export function normalizeAddress(address: string) {
  return address.toLowerCase();
}

function statusFromContract(status: number) {
  return poolStatuses[status] ?? "created";
}

function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 8; index++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

export async function readPoolFromChain(onchainPoolId: number) {
  const result = await publicClient.readContract({
    ...rotatingSavingsPoolContract,
    functionName: "getPool",
    args: [BigInt(onchainPoolId)]
  });

  const [creator, token, contributionAmount, maxMembers, currentRound, status, memberCount] = result;

  return {
    creatorAddress: normalizeAddress(creator),
    tokenAddress: normalizeAddress(token),
    contributionAmount: contributionAmount.toString(),
    maxMembers: Number(maxMembers),
    currentRound: Number(currentRound),
    status: statusFromContract(Number(status)),
    memberCount: Number(memberCount)
  };
}

export async function createPoolMetadata(input: CreatePoolMetadataInput) {
  const db = getDb();
  const contractAddress = normalizeAddress(input.contractAddress);

  const existing = await getPoolByOnchainId(input.chainId, contractAddress, input.onchainPoolId);
  if (existing) {
    return { pool: existing, created: false };
  }

  let onchainPool: Awaited<ReturnType<typeof readPoolFromChain>>;
  try {
    onchainPool = await readPoolFromChain(input.onchainPoolId);
  } catch (error) {
    throw new Error(
      `Unable to verify pool ${input.onchainPoolId} on-chain before storing metadata: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }

  const base: Omit<PoolInsert, "inviteCode"> = {
    chainId: input.chainId,
    contractAddress,
    onchainPoolId: input.onchainPoolId,
    creatorAddress: onchainPool.creatorAddress,
    tokenAddress: onchainPool.tokenAddress,
    contributionAmount: onchainPool.contributionAmount,
    maxMembers: onchainPool.maxMembers,
    currentRound: onchainPool.currentRound,
    status: onchainPool.status,
    title: input.title,
    description: input.description,
    createdTxHash: input.createdTxHash
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const inserted = await db
      .insert(pools)
      .values({ ...base, inviteCode: generateInviteCode() })
      .onConflictDoNothing()
      .returning();

    if (inserted[0]) {
      return { pool: inserted[0], created: true };
    }

    const duplicate = await getPoolByOnchainId(input.chainId, contractAddress, input.onchainPoolId);
    if (duplicate) {
      return { pool: duplicate, created: false };
    }
  }

  throw new Error("Unable to generate a unique invite code");
}

export async function listPools(filters: PoolFilters = {}) {
  const db = getDb();
  const clauses = [];

  if (filters.creator) {
    clauses.push(eq(pools.creatorAddress, normalizeAddress(filters.creator)));
  }

  if (filters.status) {
    clauses.push(eq(pools.status, filters.status.toLowerCase()));
  }

  if (filters.member) {
    const memberAddress = normalizeAddress(filters.member);
    const rows = await db
      .select({ pool: pools })
      .from(pools)
      .innerJoin(poolMembers, eq(poolMembers.poolId, pools.id))
      .where(
        and(
          eq(poolMembers.memberAddress, memberAddress),
          ...clauses
        )
      );

    return rows.map((row) => row.pool);
  }

  return db
    .select()
    .from(pools)
    .where(clauses.length > 0 ? and(...clauses) : undefined);
}

export async function getPoolById(id: string) {
  const db = getDb();
  const rows = await db.select().from(pools).where(eq(pools.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getPoolByInviteCode(inviteCode: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(pools)
    .where(eq(pools.inviteCode, inviteCode.toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPoolByOnchainId(
  chainId: number,
  contractAddress: string,
  onchainPoolId: number
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(pools)
    .where(
      and(
        eq(pools.chainId, chainId),
        eq(pools.contractAddress, normalizeAddress(contractAddress)),
        eq(pools.onchainPoolId, onchainPoolId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}
