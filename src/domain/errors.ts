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
  /**
   * Stable key into the i18n `errors` dictionary. When set, the UI renders the
   * localized message for this key instead of `message` (which stays as a
   * non-localized fallback for logs/tests/contexts without a translator).
   */
  messageKey?: string;
  cause?: unknown;
  data?: Record<string, unknown>;
};

export const appError = (
  code: AppErrorCode,
  message: string,
  extras?: { cause?: unknown; data?: Record<string, unknown>; messageKey?: string },
): AppError => ({
  code,
  message,
  messageKey: extras?.messageKey,
  cause: extras?.cause,
  data: extras?.data,
});

export const isAppError = (e: unknown): e is AppError => {
  if (!e || typeof e !== "object") return false;
  const anyE = e as Record<string, unknown>;
  return typeof anyE.code === "string" && typeof anyE.message === "string";
};

