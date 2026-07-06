import { and, eq, sql } from "drizzle-orm";
import {
  indexedEvents,
  indexerState,
  payouts,
  poolMembers,
  poolRounds,
  pools,
  roundContributions
} from "@arcloop/db";
import { decodeEventLog } from "viem";
import { rotatingSavingsPoolAbi } from "@arcloop/web3";

import { env } from "../config/env";
import {
  publicClient,
  rotatingSavingsPoolAddress,
  rotatingSavingsPoolContract
} from "../config/contracts";
import { getDb } from "../db/client";

export type RunIndexerOnceOptions = {
  fromBlock?: number;
  toBlock?: number;
};

const poolStatuses = ["created", "active", "completed", "cancelled"] as const;

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

function statusFromContract(status: number) {
  return poolStatuses[status] ?? "created";
}

function toJsonValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toJsonValue(nestedValue)])
    );
  }

  return value;
}

async function findPool(chainId: number, contractAddress: string, onchainPoolId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(pools)
    .where(
      and(
        eq(pools.chainId, chainId),
        eq(pools.contractAddress, contractAddress),
        eq(pools.onchainPoolId, onchainPoolId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

async function readOnchainPool(onchainPoolId: number) {
  const result = await publicClient.readContract({
    ...rotatingSavingsPoolContract,
    functionName: "getPool",
    args: [BigInt(onchainPoolId)]
  });

  const [creator, token, contributionAmount, maxMembers, currentRound, status] = result;

  return {
    creatorAddress: normalizeAddress(creator),
    tokenAddress: normalizeAddress(token),
    contributionAmount: contributionAmount.toString(),
    maxMembers: Number(maxMembers),
    currentRound: Number(currentRound),
    status: statusFromContract(Number(status))
  };
}

async function ensurePool(chainId: number, contractAddress: string, onchainPoolId: number) {
  const existing = await findPool(chainId, contractAddress, onchainPoolId);
  if (existing) {
    return existing;
  }

  const onchainPool = await readOnchainPool(onchainPoolId);
  const inserted = await getDb()
    .insert(pools)
    .values({
      chainId,
      contractAddress,
      onchainPoolId,
      creatorAddress: onchainPool.creatorAddress,
      tokenAddress: onchainPool.tokenAddress,
      contributionAmount: onchainPool.contributionAmount,
      maxMembers: onchainPool.maxMembers,
      currentRound: onchainPool.currentRound,
      status: onchainPool.status,
      title: `Pool #${onchainPoolId}`,
      inviteCode: `POOL${onchainPoolId}`
    })
    .onConflictDoNothing()
    .returning();

  return inserted[0] ?? (await findPool(chainId, contractAddress, onchainPoolId));
}

async function getStartingBlock(explicitFromBlock?: number) {
  if (explicitFromBlock !== undefined) {
    return explicitFromBlock;
  }

  const rows = await getDb()
    .select()
    .from(indexerState)
    .where(
      and(
        eq(indexerState.chainId, env.ARC_TESTNET_CHAIN_ID),
        eq(indexerState.contractAddress, rotatingSavingsPoolAddress)
      )
    )
    .limit(1);

  return rows[0] ? rows[0].lastIndexedBlock + 1 : env.INDEXER_START_BLOCK;
}

async function applyDecodedEvent(input: {
  eventName: string;
  args: Record<string, unknown>;
  txHash: string;
  blockNumber: number;
  logIndex: number;
}) {
  const db = getDb();
  const chainId = env.ARC_TESTNET_CHAIN_ID;
  const contractAddress = rotatingSavingsPoolAddress;
  const poolId = Number(input.args.poolId);

  if (!Number.isInteger(poolId)) {
    return false;
  }

  if (input.eventName === "PoolCreated") {
    const inserted = await db
      .insert(pools)
      .values({
        chainId,
        contractAddress,
        onchainPoolId: poolId,
        creatorAddress: normalizeAddress(String(input.args.creator)),
        tokenAddress: normalizeAddress(String(input.args.token)),
        contributionAmount: String(input.args.contributionAmount),
        maxMembers: Number(input.args.maxMembers),
        currentRound: 0,
        status: "created",
        title: `Pool #${poolId}`,
        inviteCode: `POOL${poolId}`,
        createdTxHash: input.txHash,
        createdBlockNumber: input.blockNumber
      })
      .onConflictDoNothing()
      .returning();

    return inserted.length > 0;
  }

  const pool = await ensurePool(chainId, contractAddress, poolId);
  if (!pool) {
    return false;
  }

  if (input.eventName === "MemberJoined") {
    const memberIndex = Number(input.args.memberIndex);
    const memberAddress = normalizeAddress(String(input.args.member));
    await db
      .insert(poolMembers)
      .values({
        poolId: pool.id,
        chainId,
        contractAddress,
        onchainPoolId: poolId,
        memberAddress,
        memberIndex,
        joinedTxHash: input.txHash,
        joinedBlockNumber: input.blockNumber
      })
      .onConflictDoNothing();

    const payoutAmount = (BigInt(pool.contributionAmount) * BigInt(pool.maxMembers)).toString();
    await db
      .insert(poolRounds)
      .values({
        poolId: pool.id,
        onchainPoolId: poolId,
        roundIndex: memberIndex,
        recipientAddress: memberAddress,
        payoutAmount
      })
      .onConflictDoNothing();

    return true;
  }

  if (input.eventName === "PoolStarted") {
    await db
      .update(pools)
      .set({ status: "active", startedTxHash: input.txHash, updatedAt: new Date() })
      .where(eq(pools.id, pool.id));
    return true;
  }

  if (input.eventName === "ContributionMade") {
    const roundIndex = Number(input.args.round);
    const memberAddress = normalizeAddress(String(input.args.member));
    const round = await db
      .select()
      .from(poolRounds)
      .where(and(eq(poolRounds.poolId, pool.id), eq(poolRounds.roundIndex, roundIndex)))
      .limit(1);

    await db
      .insert(roundContributions)
      .values({
        poolId: pool.id,
        roundId: round[0]?.id,
        onchainPoolId: poolId,
        roundIndex,
        memberAddress,
        amount: String(input.args.amount),
        txHash: input.txHash,
        blockNumber: input.blockNumber,
        logIndex: input.logIndex
      })
      .onConflictDoNothing();

    await db
      .update(poolRounds)
      .set({
        contributionCount: sql`${poolRounds.contributionCount} + 1`,
        updatedAt: new Date()
      })
      .where(and(eq(poolRounds.poolId, pool.id), eq(poolRounds.roundIndex, roundIndex)));

    return true;
  }

  if (input.eventName === "PayoutReleased") {
    const roundIndex = Number(input.args.round);
    const recipientAddress = normalizeAddress(String(input.args.recipient));

    await db
      .insert(payouts)
      .values({
        poolId: pool.id,
        onchainPoolId: poolId,
        roundIndex,
        recipientAddress,
        amount: String(input.args.amount),
        txHash: input.txHash,
        blockNumber: input.blockNumber,
        logIndex: input.logIndex
      })
      .onConflictDoNothing();

    await db
      .update(poolRounds)
      .set({
        paidOut: true,
        payoutTxHash: input.txHash,
        payoutBlockNumber: input.blockNumber,
        updatedAt: new Date()
      })
      .where(and(eq(poolRounds.poolId, pool.id), eq(poolRounds.roundIndex, roundIndex)));

    await db
      .update(pools)
      .set({ currentRound: roundIndex + 1, updatedAt: new Date() })
      .where(eq(pools.id, pool.id));

    return true;
  }

  if (input.eventName === "PoolCompleted") {
    await db
      .update(pools)
      .set({ status: "completed", completedTxHash: input.txHash, updatedAt: new Date() })
      .where(eq(pools.id, pool.id));
    return true;
  }

  if (input.eventName === "PoolCancelled") {
    await db
      .update(pools)
      .set({ status: "cancelled", cancelledTxHash: input.txHash, updatedAt: new Date() })
      .where(eq(pools.id, pool.id));
    return true;
  }

  return false;
}

export async function runRotatingSavingsPoolIndexerOnce(options: RunIndexerOnceOptions = {}) {
  const db = getDb();
  const fromBlock = await getStartingBlock(options.fromBlock);
  const latestBlock = Number(await publicClient.getBlockNumber());
  const toBlock = options.toBlock ?? latestBlock;

  if (toBlock < fromBlock) {
    return { fromBlock, toBlock, eventCount: 0, appliedCount: 0 };
  }

  const logs = await publicClient.getLogs({
    address: rotatingSavingsPoolAddress,
    fromBlock: BigInt(fromBlock),
    toBlock: BigInt(toBlock)
  });

  let appliedCount = 0;

  for (const log of logs) {
    if (!log.transactionHash || log.blockNumber === null || log.logIndex === null) {
      continue;
    }

    const decoded = decodeEventLog({
      abi: rotatingSavingsPoolAbi,
      data: log.data,
      topics: log.topics
    });

    const eventName = decoded.eventName;
    const args = decoded.args as Record<string, unknown>;
    const blockNumber = Number(log.blockNumber);
    const logIndex = Number(log.logIndex);

    const inserted = await db
      .insert(indexedEvents)
      .values({
        chainId: env.ARC_TESTNET_CHAIN_ID,
        contractAddress: rotatingSavingsPoolAddress,
        eventName,
        txHash: log.transactionHash,
        blockNumber,
        logIndex,
        payloadJson: toJsonValue(args)
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) {
      continue;
    }

    const applied = await applyDecodedEvent({
      eventName,
      args,
      txHash: log.transactionHash,
      blockNumber,
      logIndex
    });

    if (applied) {
      appliedCount++;
    }
  }

  await db
    .insert(indexerState)
    .values({
      chainId: env.ARC_TESTNET_CHAIN_ID,
      contractAddress: rotatingSavingsPoolAddress,
      lastIndexedBlock: toBlock
    })
    .onConflictDoUpdate({
      target: [indexerState.chainId, indexerState.contractAddress],
      set: {
        lastIndexedBlock: toBlock,
        updatedAt: new Date()
      }
    });

  return {
    fromBlock,
    toBlock,
    eventCount: logs.length,
    appliedCount
  };
}
