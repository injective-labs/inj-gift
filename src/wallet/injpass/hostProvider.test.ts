// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

type HostSession = {
  authenticated: boolean;
  address: string | null;
  walletName?: string;
  chainId: number;
};

function dispatchSession(parent: WindowProxy, session: HostSession): void {
  const event = new MessageEvent("message", {
    data: { channel: "injpass-miniapp-v1", type: "session", session },
    origin: "http://localhost:3000",
  });
  Object.defineProperty(event, "source", { value: parent });
  window.dispatchEvent(event);
}

function postedRpcRequests(parent: WindowProxy): Array<{ id: string; method: string }> {
  const postMessage = parent.postMessage as ReturnType<typeof vi.fn>;
  return postMessage.mock.calls
    .map(([message]) => message as { type?: string; id?: string; method?: string })
    .filter((message): message is { type: string; id: string; method: string } => (
      message.type === "rpc-request" && typeof message.id === "string" && typeof message.method === "string"
    ));
}

function dispatchRpcResult(parent: WindowProxy, id: string, result: unknown): void {
  const event = new MessageEvent("message", {
    data: { channel: "injpass-miniapp-v1", type: "rpc-response", id, result },
    origin: "http://localhost:3000",
  });
  Object.defineProperty(event, "source", { value: parent });
  window.dispatchEvent(event);
}

describe("InjPassHostProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/?injpass_miniapp=1&injpass_host_origin=http://localhost:3000");
  });

  it("returns an authenticated host session without requesting login", async () => {
    const parent = { postMessage: vi.fn() } as unknown as WindowProxy;
    Object.defineProperty(window, "parent", { configurable: true, value: parent });
    const { getInjpassHostProvider } = await import("@/wallet/injpass/hostProvider");
    const provider = getInjpassHostProvider();

    dispatchSession(parent, {
      authenticated: true,
      address: "0xabc",
      walletName: "2333_1",
      chainId: 1439,
    });

    await expect(provider!.waitForAuthenticatedSession()).resolves.toMatchObject({
      address: "0xabc",
      walletName: "2333_1",
    });
    expect(postedRpcRequests(parent).map(({ method }) => method)).not.toContain("injpass_requestLogin");
  });

  it("requests login once and waits for the next authenticated session", async () => {
    const parent = { postMessage: vi.fn() } as unknown as WindowProxy;
    Object.defineProperty(window, "parent", { configurable: true, value: parent });
    const { getInjpassHostProvider } = await import("@/wallet/injpass/hostProvider");
    const provider = getInjpassHostProvider();

    dispatchSession(parent, { authenticated: false, address: null, chainId: 1439 });
    const sessionPromise = provider!.waitForAuthenticatedSession();
    await vi.waitFor(() => {
      expect(postedRpcRequests(parent).some(({ method }) => method === "injpass_requestLogin")).toBe(true);
    });
    const loginRequest = postedRpcRequests(parent).find(({ method }) => method === "injpass_requestLogin");
    dispatchRpcResult(parent, loginRequest!.id, true);
    dispatchSession(parent, {
      authenticated: true,
      address: "0xdef",
      walletName: "next",
      chainId: 1439,
    });

    await expect(sessionPromise).resolves.toMatchObject({ address: "0xdef", walletName: "next" });
    expect(postedRpcRequests(parent).filter(({ method }) => method === "injpass_requestLogin")).toHaveLength(1);
  });

  it("times out when host login is not completed", async () => {
    vi.useFakeTimers();
    try {
      const parent = { postMessage: vi.fn() } as unknown as WindowProxy;
      Object.defineProperty(window, "parent", { configurable: true, value: parent });
      const { getInjpassHostProvider } = await import("@/wallet/injpass/hostProvider");
      const provider = getInjpassHostProvider();

      dispatchSession(parent, { authenticated: false, address: null, chainId: 1439 });
      const sessionPromise = provider!.waitForAuthenticatedSession(20);
      const rejection = expect(sessionPromise).rejects.toThrow("INJ Pass login was not completed.");
      await vi.advanceTimersByTimeAsync(0);
      const loginRequest = postedRpcRequests(parent).find(({ method }) => method === "injpass_requestLogin");
      dispatchRpcResult(parent, loginRequest!.id, true);
      await vi.advanceTimersByTimeAsync(20);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it("emits account and chain changes from the global host session", async () => {
    const parent = { postMessage: vi.fn() } as unknown as WindowProxy;
    Object.defineProperty(window, "parent", { configurable: true, value: parent });
    const { getInjpassHostProvider } = await import("@/wallet/injpass/hostProvider");
    const provider = getInjpassHostProvider();
    const accountsChanged = vi.fn();
    const chainChanged = vi.fn();
    provider!.on("accountsChanged", accountsChanged);
    provider!.on("chainChanged", chainChanged);

    dispatchSession(parent, { authenticated: true, address: "0xabc", chainId: 1439 });
    dispatchSession(parent, { authenticated: true, address: "0xdef", chainId: 1776 });

    expect(accountsChanged).toHaveBeenLastCalledWith(["0xdef"]);
    expect(chainChanged).toHaveBeenLastCalledWith("0x6f0");
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
