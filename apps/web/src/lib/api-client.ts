import { API_BASE_URL } from "../config/env";
import type {
  ApiResponse,
  ChainInfo,
  CircleLoginConfig,
  CircleSocialDeviceToken,
  ContractInfo,
  CreatePoolTransactionInput,
  CreatePoolTransactionResult,
  DevCreatePoolTransactionResult,
  FinalizePoolActionTransactionInput,
  FinalizePoolActionTransactionResult,
  FinalizePoolTransactionInput,
  FinalizePoolTransactionResult,
  HealthInfo,
  PinSetupChallengeInfo,
  Pool,
  PoolActionTransactionResult,
  PoolDetail,
  WalletInfo,
  WalletChallengeInfo
} from "../types/api";

async function parseJson<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error("The API returned a response that could not be parsed.");
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function getErrorMessage(error: unknown) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "The API returned an error.";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });
  const payload = await parseJson<T>(response);
  const apiError = getErrorMessage(payload.error);

  if (!response.ok || apiError) {
    throw new ApiRequestError(apiError ?? `Request failed with status ${response.status}.`, response.status);
  }

  if (payload.data === null) {
    throw new Error("The API response did not include data.");
  }

  return payload.data;
}

export function getHealth() {
  return request<HealthInfo>("/health");
}

export function getArcTestnetInfo() {
  return request<ChainInfo>("/chains/arc-testnet");
}

export function getContractInfo() {
  return request<ContractInfo>("/contracts/rotating-savings-pool");
}

export function getPools() {
  return request<Pool[]>("/pools");
}

export function getPoolById(id: string, userToken?: string) {
  return request<PoolDetail>(`/pools/${encodeURIComponent(id)}`, {
    headers: userToken ? authHeaders(userToken) : undefined
  });
}

export function getInvite(inviteCode: string) {
  return request<Pool>(`/invites/${encodeURIComponent(inviteCode)}`);
}

export function getCircleLoginConfig() {
  return request<CircleLoginConfig>("/wallets/circle/config");
}

export function createCircleSocialDeviceToken(deviceId: string) {
  return request<CircleSocialDeviceToken>("/wallets/circle/social-device-token", {
    method: "POST",
    headers: {
      "x-circle-device-id": deviceId
    }
  });
}

function authHeaders(userToken: string) {
  return {
    Authorization: `Bearer ${userToken}`
  };
}

export function getMyWallet(userToken: string) {
  return request<WalletInfo>("/wallets/me", {
    headers: authHeaders(userToken)
  });
}

export function createMyWallet(userToken: string) {
  return request<WalletChallengeInfo>("/wallets/me", {
    method: "POST",
    headers: authHeaders(userToken)
  });
}

export function createPinSetupChallenge(userToken: string) {
  return request<PinSetupChallengeInfo>("/wallets/me/pin/setup", {
    method: "POST",
    headers: authHeaders(userToken)
  });
}

export function createPoolTransaction(input: CreatePoolTransactionInput, userToken: string) {
  return request<CreatePoolTransactionResult>("/wallets/me/pools/create-transaction", {
    method: "POST",
    headers: {
      ...authHeaders(userToken),
      "x-arcloop-title": encodeURIComponent(input.title),
      "x-arcloop-description": encodeURIComponent(input.description ?? ""),
      "x-arcloop-contribution-amount": encodeURIComponent(input.contributionAmount),
      "x-arcloop-max-members": encodeURIComponent(String(input.maxMembers))
    }
  });
}

export function finalizePoolTransaction(input: FinalizePoolTransactionInput, userToken: string) {
  return request<FinalizePoolTransactionResult>("/wallets/me/pools/finalize-transaction", {
    method: "POST",
    headers: {
      ...authHeaders(userToken),
      "x-arcloop-challenge-id": encodeURIComponent(input.challengeId),
      "x-arcloop-title": encodeURIComponent(input.title),
      "x-arcloop-description": encodeURIComponent(input.description ?? "")
    }
  });
}

export function createPoolApproveTransaction(poolId: string, userToken: string) {
  return request<PoolActionTransactionResult>(
    `/wallets/me/pools/${encodeURIComponent(poolId)}/approve-transaction`,
    {
      method: "POST",
      headers: authHeaders(userToken)
    }
  );
}

export function createPoolJoinTransaction(poolId: string, userToken: string) {
  return request<PoolActionTransactionResult>(
    `/wallets/me/pools/${encodeURIComponent(poolId)}/join-transaction`,
    {
      method: "POST",
      headers: authHeaders(userToken)
    }
  );
}

export function createPoolContributeTransaction(poolId: string, userToken: string) {
  return request<PoolActionTransactionResult>(
    `/wallets/me/pools/${encodeURIComponent(poolId)}/contribute-transaction`,
    {
      method: "POST",
      headers: authHeaders(userToken)
    }
  );
}

export function finalizePoolActionTransaction(
  poolId: string,
  input: FinalizePoolActionTransactionInput,
  userToken: string
) {
  return request<FinalizePoolActionTransactionResult>(
    `/wallets/me/pools/${encodeURIComponent(poolId)}/finalize-transaction`,
    {
      method: "POST",
      headers: {
        ...authHeaders(userToken),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    }
  );
}

export function createDevPoolTransaction(input: CreatePoolTransactionInput) {
  return request<DevCreatePoolTransactionResult>("/dev/pools/create-transaction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
}
