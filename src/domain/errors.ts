export type AppErrorCode =
  | "USER_REJECTED"
  | "WRONG_NETWORK"
  | "INSUFFICIENT_FUNDS"
  | "RPC_ERROR"
  | "REVERT"
  | "SIMULATION_FAILED"
  | "INVALID_INPUT"
  | "NOT_SUPPORTED"
  | "NOT_FOUND"
  | "UNKNOWN";

export type AppError = {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
  data?: Record<string, unknown>;
};

export const appError = (
  code: AppErrorCode,
  message: string,
  extras?: { cause?: unknown; data?: Record<string, unknown> },
): AppError => ({
  code,
  message,
  cause: extras?.cause,
  data: extras?.data,
});

export const isAppError = (e: unknown): e is AppError => {
  if (!e || typeof e !== "object") return false;
  const anyE = e as Record<string, unknown>;
  return typeof anyE.code === "string" && typeof anyE.message === "string";
};

