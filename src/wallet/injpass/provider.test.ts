// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const { hostedProvider } = vi.hoisted(() => ({
  hostedProvider: {
    isInjPass: true,
    request: vi.fn(),
    subscribe: vi.fn(),
    waitForAuthenticatedSession: vi.fn(),
  },
}));

vi.mock("@/wallet/injpass/hostProvider", () => ({
  isInjpassMiniAppHost: () => true,
  getInjpassHostProvider: () => hostedProvider,
}));

describe("connectInjpass in an INJ Pass mini app", () => {
  beforeEach(() => {
    vi.resetModules();
    hostedProvider.request.mockReset();
    hostedProvider.subscribe.mockReset();
    hostedProvider.subscribe.mockReturnValue(() => undefined);
    hostedProvider.waitForAuthenticatedSession.mockReset();
    hostedProvider.waitForAuthenticatedSession.mockResolvedValue({
      authenticated: true,
      address: "0xdef",
      walletName: "2333_1",
      chainId: 1439,
    });
  });

  it("adopts the authenticated global host session", async () => {
    const { connectInjpass } = await import("@/wallet/injpass/provider");

    const result = await connectInjpass();

    expect(hostedProvider.waitForAuthenticatedSession).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      provider: hostedProvider,
      address: "0xdef",
      walletName: "2333_1",
    });
  });

  it("does not replace or call an installed extension provider", async () => {
    const extension = { isMetaMask: true, request: vi.fn() };
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      writable: true,
      value: extension,
    });
    const { connectInjpass, getInjpassEip1193 } = await import(
      "@/wallet/injpass/provider"
    );

    const result = await connectInjpass();

    expect(window.ethereum).toBe(extension);
    expect(extension.request).not.toHaveBeenCalled();
    expect(getInjpassEip1193()).toBe(result.provider);
  });

  it("tracks wallet switches and logout from the global host session", async () => {
    const { connectInjpass, isInjpassConnected } = await import("@/wallet/injpass/provider");
    await connectInjpass();
    const sessionListener = hostedProvider.subscribe.mock.calls[0]?.[0] as (
      session: { authenticated: boolean; address: string | null; walletName?: string; chainId: number },
    ) => void;

    sessionListener({
      authenticated: true,
      address: "0x456",
      walletName: "switched",
      chainId: 1439,
    });
    await expect(connectInjpass()).resolves.toMatchObject({
      address: "0x456",
      walletName: "switched",
    });

    sessionListener({ authenticated: false, address: null, chainId: 1439 });
    expect(isInjpassConnected()).toBe(false);
  });
});
