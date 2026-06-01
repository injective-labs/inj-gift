"use client";
import { toast } from "sonner";
import { useState, useCallback } from "react";

export enum TxStatus {
  Idle = "idle",
  Pending = "pending",
  Success = "success",
  Error = "error",
}

export interface TxLifecycle {
  status: TxStatus;
  txHash?: string;
  error?: Error;
  start: <T>(promise: Promise<T>) => Promise<T>;
}

export const useTxLifecycle = (): TxLifecycle => {
  const [status, setStatus] = useState<TxStatus>(TxStatus.Idle);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [error, setError] = useState<Error | undefined>();

  const start = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    setStatus(TxStatus.Pending);
    setError(undefined);
    setTxHash(undefined);
    const toastId = toast.loading("Tx pending ...");
    try {
      const res = await p;
      if (res && typeof res === "object" && "transactionHash" in res) {
        const hash = (res as { transactionHash?: string }).transactionHash;
        if (typeof hash === "string") setTxHash(hash);
      }
      setStatus(TxStatus.Success);
      toast.success("Tx confirmed", { id: toastId });
      return res;
    } catch (e: unknown) {
      setStatus(TxStatus.Error);
      const msg = e instanceof Error ? e.message : String(e);
      const err = e instanceof Error ? e : new Error(msg);
      setError(err);
      toast.error(msg || "Tx failed", { id: toastId });
      throw err;
    }
  }, []);

  return { status, txHash, error, start } as const;
};





