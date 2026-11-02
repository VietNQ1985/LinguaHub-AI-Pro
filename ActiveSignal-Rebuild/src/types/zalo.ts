export type ZaloWindowStatus = "closed" | "opening" | "loading" | "ready" | "failed";

export interface ZaloStatus {
  status: ZaloWindowStatus;
  error: string | null;
}
