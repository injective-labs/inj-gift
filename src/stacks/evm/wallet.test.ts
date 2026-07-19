// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  browserProviderConstructor,
  connectInjpass,
  getInjpassEip1193,
  getNetwork,
  getSigner,
  injpassProvider,
  providerSend,
  signerGetAddress,
} = vi.hoisted(() => {
  const injpassProvider = { isInjPass: true, request: vi.fn() };
  return {
    browserProviderConstructor: vi.fn(),
    connectInjpass: vi.fn(),
    getInjpassEip1193: vi.fn(),
    getNetwork: vi.fn(),
    getSigner: vi.fn(),
    injpassProvider,
    providerSend: vi.fn(),
    signerGetAddress: vi.fn(),
  };
});

vi.mock("@/wallet/injpass/provider", () => ({
  connectInjpass,
  getInjpassEip1193,
}));

vi.mock("./config", () => ({
  evmChain: {
    chainId: 1439,
    params: { chainName: "Injective inEVM" },
  },
}));

vi.mock("ethers", () => {
  class FakeBrowserProvider {
    constructor(provider: unknown) {
      browserProviderConstructor(provider);
    }

    send = providerSend;
    getSigner = getSigner;
    getNetwork = getNetwork;
  }

  return {
    BrowserProvider: FakeBrowserProvider,
    ethers: { BrowserProvider: FakeBrowserProvider },
  };
});

describe("EvmWallet", () => {
  beforeEach(() => {
    vi.resetModules();
    browserProviderConstructor.mockClear();
    connectInjpass.mockReset().mockResolvedValue({
      provider: injpassProvider,
      address: "0x0000000000000000000000000000000000000001",
      walletName: "INJ Pass",
    });
    getInjpassEip1193.mockReset().mockReturnValue(undefined);
    providerSend.mockReset().mockResolvedValue([
      "0x0000000000000000000000000000000000000001",
    ]);
    signerGetAddress.mockReset().mockResolvedValue(
      "0x0000000000000000000000000000000000000001",
    );
    getSigner.mockReset().mockResolvedValue({ getAddress: signerGetAddress });
    getNetwork.mockReset().mockResolvedValue({ chainId: 1439n });
  });

  it("connects INJ Pass before requesting an account", async () => {
    const { EvmWallet } = await import("./wallet");
    const wallet = new EvmWallet();

    await wallet.connect();

    expect(connectInjpass).toHaveBeenCalledOnce();
    expect(browserProviderConstructor).toHaveBeenCalledWith(injpassProvider);
    expect(providerSend).toHaveBeenCalledWith("eth_requestAccounts", []);
  });

  it("never calls an injected browser wallet", async () => {
    const extensionRequest = vi.fn();
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: { isMetaMask: true, request: extensionRequest },
    });
    const { EvmWallet } = await import("./wallet");
    const wallet = new EvmWallet();

    await wallet.connect();

    expect(extensionRequest).not.toHaveBeenCalled();
    expect(browserProviderConstructor).toHaveBeenCalledWith(injpassProvider);
  });
});
