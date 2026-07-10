export type ApiResponse<T> = {
  data: T | null;
  error: unknown;
};

export type HealthInfo = {
  status: string;
  service: string;
};

export type ChainInfo = {
  name: string;
  rpcUrl: string;
  chainId: number;
  explorerUrl: string;
};

export type ContractInfo = {
  chainId: number;
  address: string;
  explorerUrl: string;
  usdcTokenAddress: string;
};

export type Pool = {
  id: string;
  chainId: number;
  contractAddress: string;
  onchainPoolId: number;
  creatorAddress: string;
  tokenAddress: string;
  contributionAmount: string;
  maxMembers: number;
  currentRound: number;
  status: string;
  title: string;
  description: string | null;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
};

export type PoolMember = {
  id: string;
  poolId: string;
  chainId: number;
  contractAddress: string;
  onchainPoolId: number;
  memberAddress: string;
  memberIndex: number;
  joinedTxHash: string | null;
  joinedBlockNumber: number | null;
  createdAt: string;
};

export type PoolRound = {
  id: string;
  poolId: string;
  onchainPoolId: number;
  roundIndex: number;
  recipientAddress: string;
  contributionCount: number;
  payoutAmount: string;
  paidOut: boolean;
  payoutTxHash: string | null;
  payoutBlockNumber: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RoundContribution = {
  id: string;
  poolId: string;
  roundId: string | null;
  onchainPoolId: number;
  roundIndex: number;
  memberAddress: string;
  amount: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  createdAt: string;
};

export type PoolDetail = {
  pool: Pool;
  members: PoolMember[];
  rounds: PoolRound[];
  contributions: RoundContribution[];
  chainState: {
    members: string[];
    membersJoined: number;
    currentRecipient: string | null;
    contributionProgress: number;
    poolFull: boolean;
    nextRequiredAction: string;
    contractGaps: string[];
    viewer: {
      walletAddressPresent: boolean;
      walletExists: boolean;
      hasCurrentUserJoined: boolean | null;
      hasCurrentUserContributed: boolean | null;
      allowanceSufficient: boolean | null;
      balanceSufficient: boolean | null;
    };
  };
};

export type WalletRuntimeState =
  | "CIRCLE_NOT_CONFIGURED"
  | "WALLET_NOT_CREATED"
  | "TRANSACTION_SUBMITTED"
  | "TRANSACTION_PENDING"
  | "TRANSACTION_CONFIRMED"
  | "TRANSACTION_FAILED"
  | "NOT_IMPLEMENTED";

export type SafeWalletMetadata = {
  walletId: string | null;
  address: string | null;
  status: WalletRuntimeState;
};

export type WalletInfo = {
  wallet: SafeWalletMetadata;
  circle: {
    configured: boolean;
    requiredEnvVars: string[];
  };
};

export type CircleLoginConfig = {
  appId: string | null;
  googleClientId: string | null;
  googleRedirectUri: string | null;
  configured: boolean;
  requiredEnvVars: string[];
};

export type CircleSocialDeviceToken = CircleLoginConfig & {
  deviceToken: string | null;
  deviceEncryptionKey: string | null;
};

export type WalletChallengeInfo = {
  wallet: {
    challengeId: string | null;
    status: WalletRuntimeState;
    wallet: SafeWalletMetadata;
  };
  circle: CircleLoginConfig;
};

export type PinSetupChallengeInfo = {
  pin: {
    challengeId: string | null;
    status: WalletRuntimeState;
  };
  circle: CircleLoginConfig;
};

export type CreatePoolTransactionInput = {
  title: string;
  description?: string;
  contributionAmount: string;
  maxMembers: number;
};

export type CreatePoolTransactionResult = {
  pool: {
    title: string;
    description: string | null;
    contributionAmount: string;
    maxMembers: number;
  };
  transaction: {
    challengeId: string | null;
    transactionId: string | null;
    transactionHash: string | null;
    status: WalletRuntimeState;
    message: string;
  };
  request: {
    chainId: number;
    contractAddress: string;
    usdcTokenAddress: string;
    explorerUrl: string;
    calldata: string;
  };
};

export type FinalizePoolTransactionInput = {
  challengeId: string;
  title: string;
  description?: string;
};

export type FinalizePoolTransactionResult = {
  transaction: {
    challengeStatus: string | null;
    challengeType: string | null;
    transactionId: string | null;
    transactionHash: string | null;
    transactionState: string | null;
    status: WalletRuntimeState;
    message: string;
  };
  poolMetadata: {
    pool: Pool;
    created: boolean;
  } | null;
};

export type PoolAction = "approve" | "join" | "contribute";

export type PoolActionTransactionResult = {
  pool: Pool;
  transaction: {
    challengeId: string | null;
    transactionId: string | null;
    transactionHash: string | null;
    status: WalletRuntimeState;
    message: string;
  };
  action: PoolAction;
};

export type FinalizePoolActionTransactionInput = {
  challengeId: string;
  action: PoolAction;
};

export type FinalizePoolActionTransactionResult = {
  transaction: FinalizePoolTransactionResult["transaction"];
  pool: Pool | null;
  action: PoolAction;
};

export type DevCreatePoolTransactionResult = {
  txHash: string;
  chainId: number;
  contractAddress: string;
  explorerUrl: string;
  calldata: string;
  status: "TRANSACTION_SUBMITTED" | "TRANSACTION_CONFIRMED" | "TRANSACTION_FAILED";
};
