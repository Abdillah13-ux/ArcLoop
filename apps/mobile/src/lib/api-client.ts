import { API_BASE_URL } from "../config/env";
import type {
  ApiResponse,
  ChainInfo,
  ContractInfo,
  HealthInfo,
  Pool
} from "../types/api";

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error("API returned a response that could not be parsed.");
  }
}

function errorMessage(error: unknown) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "API returned an error.";
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const payload = await readJson<T>(response);
  const message = errorMessage(payload.error);

  if (!response.ok || message) {
    throw new Error(message ?? `API request failed with status ${response.status}.`);
  }

  if (payload.data === null) {
    throw new Error("API response did not include data.");
  }

  return payload.data;
}

export function getHealth() {
  return request<HealthInfo>("/health");
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

export function getArcTestnetInfo() {
  return request<ChainInfo>("/chains/arc-testnet");
}
