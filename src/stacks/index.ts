import { z } from "zod";
import { appError } from "@/domain/errors";
import type { AppError } from "@/domain/errors";
import type { GiftAdapter } from "@/domain/giftAdapter";
import { EvmGiftAdapter } from "./evm/adapter";
import { WasmGiftAdapter } from "./wasm/adapter";
import { evmConfig, getEvmConfigOrThrow } from "./evm/config";
import { isWasmConfigured } from "./wasm/config";

const StackModeSchema = z.enum(["auto", "evm", "wasm"]);
type StackMode = z.infer<typeof StackModeSchema>;

function parseStackMode(): StackMode {
  const raw = process.env.NEXT_PUBLIC_STACK_MODE;
  const parsed = StackModeSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("❌ Invalid NEXT_PUBLIC_STACK_MODE:", raw);
    return "auto";
  }
  return parsed.data;
}

function chooseAdapter(): GiftAdapter {
  const mode = parseStackMode();
  const evmOk = evmConfig.isConfigured;
  const wasmOk = isWasmConfigured();

  if (mode === "evm") {
    if (!evmOk) throw appError("INVALID_INPUT", "EVM mode selected but EVM env vars are missing");
    getEvmConfigOrThrow(); // will throw if still not configured (defensive)
    return new EvmGiftAdapter();
  }

  if (mode === "wasm") {
    if (!wasmOk) throw appError("INVALID_INPUT", "WASM mode selected but WASM env vars are missing");
    return new WasmGiftAdapter();
  }

  // auto
  if (evmOk) return new EvmGiftAdapter();
  if (wasmOk) return new WasmGiftAdapter();

  throw appError(
    "INVALID_INPUT",
    "No stack is configured. Set NEXT_PUBLIC_EVM_* or NEXT_PUBLIC_WASM_* env vars, or force a mode via NEXT_PUBLIC_STACK_MODE=evm|wasm",
  );
}

export const getGiftAdapter = (): GiftAdapter => {
  try {
    return chooseAdapter();
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && "message" in e) {
      throw e as AppError;
    }
    throw appError("UNKNOWN", "Failed to select adapter", { cause: e });
  }
};

export type { StackMode };
