"use client";

import { useCallback, useState } from "react";
import type { TxState } from "@/domain/tx";
import { txIdle, txSigning, txPending, txConfirmed, txFailed } from "@/domain/tx";
import { normalizeError } from "@/domain/normalizeError";

export const useTx = <TReceipt = unknown>() => {
  const [state, setState] = useState<TxState<TReceipt>>(txIdle());

  const reset = useCallback(() => setState(txIdle()), []);

  const run = useCallback(
    async (fn: () => Promise<{ hash: string; receipt?: TReceipt } | { hash: string }>) => {
      setState(txSigning());
      try {
        const res = await fn();
        setState(txPending(res.hash));
        // By default, we don't wait for receipt here; adapters may provide it.
        setState(txConfirmed(res.hash, (res as any).receipt));
        return res.hash;
      } catch (e: unknown) {
        const err = normalizeError(e);
        setState(txFailed(err));
        throw err;
      }
    },
    [],
  );

  return { state, run, reset } as const;
};


