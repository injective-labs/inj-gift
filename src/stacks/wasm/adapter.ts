import { appError } from "@/domain/errors";
import type { GiftAdapter } from "@/domain/giftAdapter";
import type { ClaimPacketInput, CreatePacketInput, GiftPacket, TxResult } from "@/domain/types";
import { isWasmConfigured, wasmEnv } from "./config";

export class WasmGiftAdapter implements GiftAdapter {
  readonly stack = "wasm" as const;

  async connect(): Promise<void> {
    // Wallet connect handled by cosmos-kit in UI provider; adapter stays logic-only.
    if (!isWasmConfigured()) {
      throw appError(
        "NOT_SUPPORTED",
        "CosmWasm contract is not configured yet. Please set NEXT_PUBLIC_WASM_* env vars after deployment.",
        { data: { required: ["NEXT_PUBLIC_WASM_CHAIN_ID", "NEXT_PUBLIC_WASM_RPC_URL", "NEXT_PUBLIC_WASM_REST_URL", "NEXT_PUBLIC_WASM_CONTRACT_ADDRESS"] } },
      );
    }
  }

  async disconnect(): Promise<void> {
    return;
  }

  async getAddress(): Promise<string | null> {
    // Until we wrap cosmos-kit, we return null.
    return null;
  }

  async getPacket(): Promise<GiftPacket> {
    throw appError(
      "NOT_SUPPORTED",
      "CosmWasm stack placeholder: getPacket not available until wasm contract is deployed and adapter is wired.",
    );
  }

  async createPacket(): Promise<TxResult> {
    throw appError(
      "NOT_SUPPORTED",
      "CosmWasm stack placeholder: createPacket not available until wasm contract is deployed and adapter is wired.",
    );
  }

  async claimPacket(): Promise<TxResult> {
    throw appError(
      "NOT_SUPPORTED",
      "CosmWasm stack placeholder: claimPacket not available until wasm contract is deployed and adapter is wired.",
    );
  }

  async refundPacket(): Promise<TxResult> {
    throw appError(
      "NOT_SUPPORTED",
      "CosmWasm stack placeholder: refundPacket not available until wasm contract is deployed and adapter is wired.",
    );
  }
}

