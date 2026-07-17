// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

describe("InjPassHostProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    window.history.replaceState({}, "", "/?injpass_miniapp=1&injpass_host_origin=http://localhost:3000");
  });

  it("accepts correlated responses only from the configured parent origin", async () => {
    const parent = { postMessage: vi.fn() } as unknown as WindowProxy;
    Object.defineProperty(window, "parent", { configurable: true, value: parent });
    const { getInjpassHostProvider } = await import("@/wallet/injpass/hostProvider");
    const provider = getInjpassHostProvider();
    expect(provider).not.toBeNull();
    const request = provider!.request({ method: "personal_sign", params: ["0x68656c6c6f"] });
    const posted = (parent.postMessage as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as { id: string };

    const spoofed = new MessageEvent("message", {
      data: { channel: "injpass-miniapp-v1", type: "rpc-response", id: posted.id, result: "spoofed" },
      origin: "http://evil.example",
    });
    Object.defineProperty(spoofed, "source", { value: parent });
    window.dispatchEvent(spoofed);

    const valid = new MessageEvent("message", {
      data: { channel: "injpass-miniapp-v1", type: "rpc-response", id: posted.id, result: "signed" },
      origin: "http://localhost:3000",
    });
    Object.defineProperty(valid, "source", { value: parent });
    window.dispatchEvent(valid);
    await expect(request).resolves.toBe("signed");
  });

  it("preserves an INJ Pass rejection code and message", async () => {
    const parent = { postMessage: vi.fn() } as unknown as WindowProxy;
    Object.defineProperty(window, "parent", { configurable: true, value: parent });
    const { getInjpassHostProvider } = await import("@/wallet/injpass/hostProvider");
    const provider = getInjpassHostProvider();
    const request = provider!.request({ method: "eth_sendTransaction", params: [] });
    const posted = (parent.postMessage as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as { id: string };
    const response = new MessageEvent("message", {
      data: {
        channel: "injpass-miniapp-v1",
        type: "rpc-response",
        id: posted.id,
        error: { code: 4001, message: "User rejected the request." },
      },
      origin: "http://localhost:3000",
    });
    Object.defineProperty(response, "source", { value: parent });
    window.dispatchEvent(response);
    await expect(request).rejects.toMatchObject({ code: 4001, message: "User rejected the request." });
  });

  it("rejects pending requests immediately when the host session logs out", async () => {
    const parent = { postMessage: vi.fn() } as unknown as WindowProxy;
    Object.defineProperty(window, "parent", { configurable: true, value: parent });
    const { getInjpassHostProvider } = await import("@/wallet/injpass/hostProvider");
    const provider = getInjpassHostProvider();
    const request = provider!.request({ method: "eth_sendTransaction", params: [] });

    const logout = new MessageEvent("message", {
      data: {
        channel: "injpass-miniapp-v1",
        type: "session",
        session: { authenticated: false, address: null, chainId: 1439 },
      },
      origin: "http://localhost:3000",
    });
    Object.defineProperty(logout, "source", { value: parent });
    window.dispatchEvent(logout);

    await expect(request).rejects.toMatchObject({
      code: 4100,
      message: "INJ Pass wallet session ended.",
    });
  });
});
