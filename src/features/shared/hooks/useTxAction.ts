"use client";
import { useState, useCallback } from "react";

export interface TxActionState<T> {
  isLoading: boolean;
  error: T | null;
  reset: () => void;
  runTx: <R>(fn: () => Promise<R>) => Promise<R>;
}

/**
 * Generic transaction hook – keeps loading/error state, no UI side-effect.
 * Caller decides how to toast / display.
 */
export const useTxAction = <E = unknown>(): TxActionState<E> => {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<E | null>(null);

  const reset = useCallback(() => setError(null), []);

  const runTx = useCallback(async <R,>(fn: () => Promise<R>): Promise<R> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fn();
      return res;
    } catch (e) {
      setError(e as E);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { isLoading, error, reset, runTx };
};





