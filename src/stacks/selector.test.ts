import { describe, it, expect, vi, beforeEach } from "vitest";

const importSelector = async () => {
  // important: env is read at module init time
  vi.resetModules();
  return await import("@/stacks/index");
};

describe("stack selector", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("auto selects evm when evm is configured", async () => {
    process.env.NEXT_PUBLIC_STACK_MODE = "auto";
    process.env.NEXT_PUBLIC_EVM_CHAIN_ID = "1439";
    process.env.NEXT_PUBLIC_EVM_CONTRACT_ADDRESS = "0xfF2750Ac6f03d4fD4AA19D49a17DC4459cf2d6Ed";

    const { getGiftAdapter } = await importSelector();
    const adapter = getGiftAdapter();
    expect(adapter.stack).toBe("evm");
  });

  it("wasm mode throws when wasm not configured", async () => {
    process.env.NEXT_PUBLIC_STACK_MODE = "wasm";
    delete process.env.NEXT_PUBLIC_WASM_CHAIN_ID;
    delete process.env.NEXT_PUBLIC_WASM_RPC_URL;
    delete process.env.NEXT_PUBLIC_WASM_REST_URL;
    delete process.env.NEXT_PUBLIC_WASM_CONTRACT_ADDRESS;

    const { getGiftAdapter } = await importSelector();
    expect(() => getGiftAdapter()).toThrow();
  });

  it("evm mode throws when evm not configured", async () => {
    process.env.NEXT_PUBLIC_STACK_MODE = "evm";
    delete process.env.NEXT_PUBLIC_EVM_CHAIN_ID;
    delete process.env.NEXT_PUBLIC_EVM_CONTRACT_ADDRESS;

    const { getGiftAdapter } = await importSelector();
    expect(() => getGiftAdapter()).toThrow();
  });
});


