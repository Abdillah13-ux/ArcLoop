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
    name: "createPool",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "contributionAmount", type: "uint256" },
      { name: "maxMembers", type: "uint256" }
    ],
    outputs: [{ name: "poolId", type: "uint256" }]
  },
  {
    type: "function",
    name: "joinPool",
    stateMutability: "nonpayable",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "startPool",
    stateMutability: "nonpayable",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "contribute",
    stateMutability: "nonpayable",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "releasePayout",
    stateMutability: "nonpayable",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: []
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
  },
  {
    type: "function",
    name: "isMember",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "member", type: "address" }
    ],
    outputs: [{ name: "joined", type: "bool" }]
  },
  {
    type: "function",
    name: "hasContributed",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "round", type: "uint256" },
      { name: "member", type: "address" }
    ],
    outputs: [{ name: "contributed", type: "bool" }]
  },
  {
    type: "function",
    name: "roundContributionCount",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "round", type: "uint256" }
    ],
    outputs: [{ name: "count", type: "uint256" }]
  },
  {
    type: "function",
    name: "roundPaidOut",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "round", type: "uint256" }
    ],
    outputs: [{ name: "paid", type: "bool" }]
  }
] as const;

export const rotatingSavingsPoolContract = {
  address: (configuredAddress ? configuredAddress : null) as Address | null,
  abi: rotatingSavingsPoolAbi
} as const;
