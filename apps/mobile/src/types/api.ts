export type ApiResponse<T> = {
  data: T | null;
  error: unknown;
};

export type HealthInfo = {
  status: string;
  service: string;
};

export type ContractInfo = {
  chainId: number;
  address: string;
  explorerUrl: string;
  usdcTokenAddress: string;
};

export type ChainInfo = {
  name: string;
  rpcUrl: string;
  chainId: number;
  explorerUrl: string;
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
