import { z } from "zod";

const WasmEnvSchema = z.object({
  NEXT_PUBLIC_WASM_CHAIN_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_WASM_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_WASM_REST_URL: z.string().url().optional(),
  NEXT_PUBLIC_WASM_CONTRACT_ADDRESS: z
    .string()
    .regex(/^inj1[a-z0-9]{38}$/, "invalid Injective wasm address")
    .optional(),
});

type WasmEnv = z.infer<typeof WasmEnvSchema>;

const _raw = {
  NEXT_PUBLIC_WASM_CHAIN_ID: process.env.NEXT_PUBLIC_WASM_CHAIN_ID,
  NEXT_PUBLIC_WASM_RPC_URL: process.env.NEXT_PUBLIC_WASM_RPC_URL,
  NEXT_PUBLIC_WASM_REST_URL: process.env.NEXT_PUBLIC_WASM_REST_URL,
  NEXT_PUBLIC_WASM_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_WASM_CONTRACT_ADDRESS,
} as Record<string, unknown>;

export const wasmEnv: WasmEnv = (() => {
  const parsed = WasmEnvSchema.safeParse(_raw);
  if (!parsed.success) {
    console.error("❌ Invalid WASM env vars:", parsed.error.flatten().fieldErrors);
    if (process.env.NODE_ENV !== "production") {
      throw new Error("Invalid WASM env vars");
    }
    return {
      NEXT_PUBLIC_WASM_CHAIN_ID: undefined,
      NEXT_PUBLIC_WASM_RPC_URL: undefined,
      NEXT_PUBLIC_WASM_REST_URL: undefined,
      NEXT_PUBLIC_WASM_CONTRACT_ADDRESS: undefined,
    };
  }
  return parsed.data;
})();

export const isWasmConfigured = (): boolean => {
  return !!(
    wasmEnv.NEXT_PUBLIC_WASM_CHAIN_ID &&
    wasmEnv.NEXT_PUBLIC_WASM_RPC_URL &&
    wasmEnv.NEXT_PUBLIC_WASM_REST_URL &&
    wasmEnv.NEXT_PUBLIC_WASM_CONTRACT_ADDRESS
  );
};

