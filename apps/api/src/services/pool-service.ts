import { and, eq, sql, type InferInsertModel } from "drizzle-orm";
import { payouts, poolMembers, poolRounds, pools, roundContributions } from "@arcloop/db";
import type { Address } from "viem";

import {
  publicClient,
  rotatingSavingsPoolAddress,
  rotatingSavingsPoolContract
} from "../config/contracts";
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
  includeLegacy?: boolean;
};

export type PoolLifecycleEventInput = {
  poolId: string;
  chainId: number;
  contractAddress: string;
  onchainPoolId: number;
  txHash: string;
  blockNumber: number;
  logIndex: number;
};

export type PoolViewerState = {
  walletAddressPresent: boolean;
  walletExists: boolean;
  hasCurrentUserJoined: boolean | null;
  hasCurrentUserContributed: boolean | null;
  allowanceSufficient: boolean | null;
  balanceSufficient: boolean | null;
};

export type PoolChainState = {
  members: string[];
  currentRecipient: string | null;
  contributionProgress: number;
  poolFull: boolean;
  nextRequiredAction: string;
  contractGaps: string[];
  viewer: PoolViewerState;
};

const erc20ReadAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "allowance", type: "uint256" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
  }
] as const;

function getRotatingSavingsPoolContract(contractAddress: string) {
  return {
    ...rotatingSavingsPoolContract,
    address: normalizeAddress(contractAddress) as Address
  } as const;
}

export function normalizeAddress(address: string) {
  return address.toLowerCase();
}

export function getActiveContractAddress() {
  return rotatingSavingsPoolAddress;
}

export function isActiveContractAddress(contractAddress: string) {
  return normalizeAddress(contractAddress) === rotatingSavingsPoolAddress;
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

export async function readPoolFromChain(onchainPoolId: number, contractAddress: string = rotatingSavingsPoolAddress) {
  const result = await publicClient.readContract({
    ...getRotatingSavingsPoolContract(contractAddress),
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
    onchainPool = await readPoolFromChain(input.onchainPoolId, contractAddress);
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

  if (!filters.includeLegacy) {
    clauses.push(eq(pools.contractAddress, rotatingSavingsPoolAddress));
  }

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

function getNextRequiredAction(input: {
  poolStatus: string;
  poolFull: boolean;
  hasCurrentUserJoined: boolean | null;
  hasCurrentUserContributed: boolean | null;
  allowanceSufficient: boolean | null;
  balanceSufficient: boolean | null;
  contributionProgress: number;
  maxMembers: number;
  walletExists: boolean;
  walletAddressPresent: boolean;
}) {
  if (!input.walletAddressPresent) {
    return "Sign in with Circle to participate.";
  }

  if (!input.walletExists) {
    return "Create or complete a Circle wallet before joining or contributing.";
  }

  if (input.poolStatus === "completed") {
    return "Pool completed.";
  }

  if (input.poolStatus === "created") {
    if (!input.poolFull && !input.hasCurrentUserJoined) {
      return "Join Pool";
    }

    if (!input.poolFull) {
      return "Waiting for more members.";
    }

    return "Pool is full and should activate automatically after indexing catches up.";
  }

  if (input.poolStatus === "active") {
    if (!input.hasCurrentUserJoined) {
      return "This wallet has not joined the pool.";
    }

    if (input.hasCurrentUserContributed) {
      return input.contributionProgress >= input.maxMembers
        ? "Round funded; payout and next round should update automatically after indexing catches up."
        : "Waiting for other members.";
    }

    if (input.balanceSufficient === false) {
      return "Insufficient USDC balance.";
    }

    if (input.allowanceSufficient === false) {
      return "Approve USDC";
    }

    return "Contribute";
  }

  return "Pool is not accepting actions.";
}

export async function getPoolDetailById(id: string, viewerAddress?: Address | null, walletExists = false) {
  const db = getDb();
  const stalePool = await getPoolById(id);

  if (!stalePool) {
    return null;
  }

  const refreshedPool = await refreshPoolFromChain(id);
  const pool = refreshedPool ?? stalePool;
  const requiredAmount = BigInt(pool.contributionAmount);
  const poolContract = getRotatingSavingsPoolContract(pool.contractAddress);

  const [members, rounds, contributions] = await Promise.all([
    db.select().from(poolMembers).where(eq(poolMembers.poolId, id)),
    db.select().from(poolRounds).where(eq(poolRounds.poolId, id)),
    db.select().from(roundContributions).where(eq(roundContributions.poolId, id))
  ]);

  const onchainMembers = await publicClient.readContract({
    ...poolContract,
    functionName: "getMembers",
    args: [BigInt(pool.onchainPoolId)]
  });
  const contributionProgress =
    pool.status === "active"
      ? Number(
          await publicClient.readContract({
            ...poolContract,
            functionName: "roundContributionCount",
            args: [BigInt(pool.onchainPoolId), BigInt(pool.currentRound)]
          })
        )
      : 0;
  const currentRecipientAddress =
    pool.status === "active" && pool.currentRound < onchainMembers.length
      ? onchainMembers[pool.currentRound]
      : null;
  const currentRecipient = currentRecipientAddress ? normalizeAddress(currentRecipientAddress) : null;

  let hasCurrentUserJoined: boolean | null = null;
  let hasCurrentUserContributed: boolean | null = null;
  let allowanceSufficient: boolean | null = null;
  let balanceSufficient: boolean | null = null;

  if (viewerAddress) {
    const [isMember, hasContributed, balance, allowance] = await Promise.all([
      publicClient.readContract({
        ...poolContract,
        functionName: "isMember",
        args: [BigInt(pool.onchainPoolId), viewerAddress]
      }),
      pool.status === "active"
        ? publicClient.readContract({
            ...poolContract,
            functionName: "hasContributed",
            args: [BigInt(pool.onchainPoolId), BigInt(pool.currentRound), viewerAddress]
          })
        : Promise.resolve(false),
      publicClient.readContract({
        abi: erc20ReadAbi,
        address: pool.tokenAddress as Address,
        functionName: "balanceOf",
        args: [viewerAddress]
      }),
      publicClient.readContract({
        abi: erc20ReadAbi,
        address: pool.tokenAddress as Address,
        functionName: "allowance",
        args: [viewerAddress, poolContract.address]
      })
    ]);

    hasCurrentUserJoined = isMember;
    hasCurrentUserContributed = hasContributed;
    balanceSufficient = balance >= requiredAmount;
    allowanceSufficient = allowance >= requiredAmount;
  }

  const poolFull = onchainMembers.length >= pool.maxMembers;
  const viewer = {
    walletAddressPresent: Boolean(viewerAddress),
    walletExists,
    hasCurrentUserJoined,
    hasCurrentUserContributed,
    allowanceSufficient,
    balanceSufficient
  };
  const chainState = {
    members: onchainMembers.map((member) => normalizeAddress(member)),
    currentRecipient,
    contributionProgress,
    poolFull,
    nextRequiredAction: getNextRequiredAction({
      poolStatus: pool.status,
      poolFull,
      hasCurrentUserJoined,
      hasCurrentUserContributed,
      allowanceSufficient,
      balanceSufficient,
      contributionProgress,
      maxMembers: pool.maxMembers,
      walletExists,
      walletAddressPresent: Boolean(viewerAddress)
    }),
    contractGaps: [],
    viewer
  } satisfies PoolChainState;

  return {
    pool,
    members,
    rounds,
    contributions,
    chainState
  };
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

export async function refreshPoolFromChain(poolId: string) {
  const db = getDb();
  const pool = await getPoolById(poolId);

  if (!pool) {
    return null;
  }

  const onchainPool = await readPoolFromChain(pool.onchainPoolId, pool.contractAddress);

  await db
    .update(pools)
    .set({
      creatorAddress: onchainPool.creatorAddress,
      tokenAddress: onchainPool.tokenAddress,
      contributionAmount: onchainPool.contributionAmount,
      maxMembers: onchainPool.maxMembers,
      currentRound: onchainPool.currentRound,
      status: onchainPool.status,
      updatedAt: new Date()
    })
    .where(eq(pools.id, pool.id));

  return getPoolById(pool.id);
}

export async function recordMemberJoined(
  input: PoolLifecycleEventInput & {
    memberAddress: string;
    memberIndex: number;
  }
) {
  const db = getDb();
  const contractAddress = normalizeAddress(input.contractAddress);
  const memberAddress = normalizeAddress(input.memberAddress);

  const inserted = await db
    .insert(poolMembers)
    .values({
      poolId: input.poolId,
      chainId: input.chainId,
      contractAddress,
      onchainPoolId: input.onchainPoolId,
      memberAddress,
      memberIndex: input.memberIndex,
      joinedTxHash: input.txHash,
      joinedBlockNumber: input.blockNumber
    })
    .onConflictDoNothing()
    .returning();

  const pool = await getPoolById(input.poolId);
  if (pool) {
    const payoutAmount = (BigInt(pool.contributionAmount) * BigInt(pool.maxMembers)).toString();

    await db
      .insert(poolRounds)
      .values({
        poolId: input.poolId,
        onchainPoolId: input.onchainPoolId,
        roundIndex: input.memberIndex,
        recipientAddress: memberAddress,
        payoutAmount
      })
      .onConflictDoNothing();
  }

  return inserted[0] ?? null;
}

export async function recordContributionMade(
  input: PoolLifecycleEventInput & {
    memberAddress: string;
    roundIndex: number;
    amount: string;
  }
) {
  const db = getDb();
  const memberAddress = normalizeAddress(input.memberAddress);
  const round = await db
    .select()
    .from(poolRounds)
    .where(and(eq(poolRounds.poolId, input.poolId), eq(poolRounds.roundIndex, input.roundIndex)))
    .limit(1);

  const inserted = await db
    .insert(roundContributions)
    .values({
      poolId: input.poolId,
      roundId: round[0]?.id,
      onchainPoolId: input.onchainPoolId,
      roundIndex: input.roundIndex,
      memberAddress,
      amount: input.amount,
      txHash: input.txHash,
      blockNumber: input.blockNumber,
      logIndex: input.logIndex
    })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) {
    await db
      .update(poolRounds)
      .set({
        contributionCount: sql`${poolRounds.contributionCount} + 1`,
        updatedAt: new Date()
      })
      .where(and(eq(poolRounds.poolId, input.poolId), eq(poolRounds.roundIndex, input.roundIndex)));
  }

  return inserted[0] ?? null;
}

export async function recordPoolStarted(input: PoolLifecycleEventInput) {
  const db = getDb();

  await db
    .update(pools)
    .set({
      status: "active",
      currentRound: 0,
      startedTxHash: input.txHash,
      updatedAt: new Date()
    })
    .where(eq(pools.id, input.poolId));
}

export async function recordPayoutReleased(
  input: PoolLifecycleEventInput & {
    roundIndex: number;
    recipientAddress: string;
    amount: string;
  }
) {
  const db = getDb();
  const recipientAddress = normalizeAddress(input.recipientAddress);

  const inserted = await db
    .insert(payouts)
    .values({
      poolId: input.poolId,
      onchainPoolId: input.onchainPoolId,
      roundIndex: input.roundIndex,
      recipientAddress,
      amount: input.amount,
      txHash: input.txHash,
      blockNumber: input.blockNumber,
      logIndex: input.logIndex
    })
    .onConflictDoNothing()
    .returning();

  await db
    .update(poolRounds)
    .set({
      paidOut: true,
      payoutTxHash: input.txHash,
      payoutBlockNumber: input.blockNumber,
      updatedAt: new Date()
    })
    .where(and(eq(poolRounds.poolId, input.poolId), eq(poolRounds.roundIndex, input.roundIndex)));

  await db
    .update(pools)
    .set({ currentRound: input.roundIndex + 1, updatedAt: new Date() })
    .where(eq(pools.id, input.poolId));

  return inserted[0] ?? null;
}

export async function recordPoolCompleted(input: PoolLifecycleEventInput) {
  const db = getDb();

  await db
    .update(pools)
    .set({
      status: "completed",
      completedTxHash: input.txHash,
      updatedAt: new Date()
    })
    .where(eq(pools.id, input.poolId));
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
