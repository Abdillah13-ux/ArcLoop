import type { Address } from "viem";

const configuredAddress = process.env.ARCLOOP_CONTRACT_ADDRESS;

export const rotatingSavingsPoolAbi = [
  {
    type: "event",
    name: "PoolCreated",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "contributionAmount", type: "uint256", indexed: false },
      { name: "maxMembers", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "MemberJoined",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
      { name: "memberIndex", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "PoolStarted",
    inputs: [{ name: "poolId", type: "uint256", indexed: true }]
  },
  {
    type: "event",
    name: "ContributionMade",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true },
      { name: "round", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "PayoutReleased",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true },
      { name: "round", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "PoolCompleted",
    inputs: [{ name: "poolId", type: "uint256", indexed: true }]
  },
  {
    type: "event",
    name: "PoolCancelled",
    inputs: [{ name: "poolId", type: "uint256", indexed: true }]
  },
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "token", type: "address" },
      { name: "contributionAmount", type: "uint256" },
      { name: "maxMembers", type: "uint256" },
      { name: "currentRound", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "memberCount", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "getMembers",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [{ name: "members", type: "address[]" }]
  },
  {
    type: "function",
    name: "getCurrentRecipient",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [{ name: "recipient", type: "address" }]
  },
  {
    type: "function",
    name: "getRoundPayoutAmount",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [{ name: "amount", type: "uint256" }]
  },
  {
    type: "function",
    name: "getPoolCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "count", type: "uint256" }]
  }
] as const;

export const rotatingSavingsPoolContract = {
  address: (configuredAddress ? configuredAddress : null) as Address | null,
  abi: rotatingSavingsPoolAbi
} as const;
