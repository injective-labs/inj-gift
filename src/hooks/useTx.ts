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
      console.log('[inj-gift useTx] run() called, setting txSigning');
      setState(txSigning());
      try {
        const res = await fn();
        console.log('[inj-gift useTx] fn() returned:', { hash: res.hash, receipt: (res as any).receipt });
        setState(txPending(res.hash));
        // By default, we don't wait for receipt here; adapters may provide it.
        setState(txConfirmed(res.hash, (res as any).receipt));
        console.log('[inj-gift useTx] txConfirmed set, hash:', res.hash);
        return res.hash;
      } catch (e: unknown) {
        console.error('[inj-gift useTx] run() failed:', e);
        const err = normalizeError(e);
        setState(txFailed(err));
        throw err;
      }
    },
    [],
  );

  return { state, run, reset } as const;
};


