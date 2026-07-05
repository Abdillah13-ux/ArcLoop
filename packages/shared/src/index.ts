export const PoolStatus = {
  Draft: "draft",
  Open: "open",
  Active: "active",
  Completed: "completed",
  Cancelled: "cancelled"
} as const;

export type PoolStatus = (typeof PoolStatus)[keyof typeof PoolStatus];

export const RoundStatus = {
  Pending: "pending",
  Collecting: "collecting",
  PaidOut: "paid_out",
  Skipped: "skipped"
} as const;

export type RoundStatus = (typeof RoundStatus)[keyof typeof RoundStatus];

export type ApiResponse<TData> = {
  data: TData;
  error: string | null;
};
