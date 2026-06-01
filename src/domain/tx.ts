import type { AppError } from "./errors";

export type TxStatus =
  | "idle"
  | "signing"
  | "pending"
  | "confirmed"
  | "failed";

export type TxState<TReceipt = unknown> = {
  status: TxStatus;
  hash?: string;
  receipt?: TReceipt;
  error?: AppError;
};

export const txIdle = <TReceipt = unknown>(): TxState<TReceipt> => ({
  status: "idle",
});

export const txSigning = <TReceipt = unknown>(): TxState<TReceipt> => ({
  status: "signing",
});

export const txPending = <TReceipt = unknown>(hash: string): TxState<TReceipt> => ({
  status: "pending",
  hash,
});

export const txConfirmed = <TReceipt = unknown>(
  hash: string,
  receipt?: TReceipt,
): TxState<TReceipt> => ({
  status: "confirmed",
  hash,
  receipt,
});

export const txFailed = <TReceipt = unknown>(
  error: AppError,
  hash?: string,
): TxState<TReceipt> => ({
  status: "failed",
  hash,
  error,
});

