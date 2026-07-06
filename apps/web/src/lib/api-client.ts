import { API_BASE_URL } from "../config/env";
import type {
  ApiResponse,
  ChainInfo,
  ContractInfo,
  HealthInfo,
  Pool
} from "../types/api";

async function parseJson<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error("The API returned a response that could not be parsed.");
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

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const payload = await parseJson<T>(response);
  const apiError = getErrorMessage(payload.error);

  if (!response.ok || apiError) {
    throw new Error(apiError ?? `Request failed with status ${response.status}.`);
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

export function getPoolById(id: string) {
  return request<Pool>(`/pools/${encodeURIComponent(id)}`);
}

export function getInvite(inviteCode: string) {
  return request<Pool>(`/invites/${encodeURIComponent(inviteCode)}`);
}
