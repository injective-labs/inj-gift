"use client";

import { useMemo } from "react";
import { getGiftAdapter } from "@/stacks";
import type { GiftAdapter } from "@/domain/giftAdapter";
import type { AppError } from "@/domain/errors";
import { normalizeError } from "@/domain/normalizeError";
import { appError } from "@/domain/errors";

export const useGiftAdapter = (): {
  adapter: GiftAdapter;
  adapterError: AppError | null;
} => {
  const value = useMemo(() => {
    try {
      return { adapter: getGiftAdapter(), adapterError: null };
    } catch (e: unknown) {
      const err = normalizeError(e);
      return { adapter: new NoOpGiftAdapter(err), adapterError: err };
    }
  }, []);

  return value;
};

/**
 * Fallback adapter used when selector fails to construct a real adapter.
 * All methods throw the same normalized error.
 */
class NoOpGiftAdapter implements GiftAdapter {
  readonly stack = "evm" as const;

  constructor(private error: AppError) {}

  async connect(): Promise<void> {
    throw this.error;
  }
  async disconnect(): Promise<void> {
    throw this.error;
  }
  async getAddress(): Promise<string | null> {
    throw this.error;
  }
  async getPacket(): Promise<never> {
    throw this.error;
  }
  async createPacket(): Promise<never> {
    throw this.error;
  }
  async claimPacket(): Promise<never> {
    throw this.error;
  }
  async refundPacket(): Promise<never> {
    throw this.error;
  }
}
