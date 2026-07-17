import { beforeEach, describe, expect, it, vi } from "vitest";

const walletConnect = vi.fn();
const contractGetPacket = vi.fn();

vi.mock("./wallet", () => ({
  EvmWallet: class {
    connect = walletConnect;
    disconnect = vi.fn();
    getState = vi.fn(() => ({ signer: null, address: null }));
  },
}));

vi.mock("./contracts/gift", () => ({
  InjGiftContractWrapper: class {
    getPacket = contractGetPacket;
  },
}));

vi.mock("./config", () => ({
  getEvmConfigOrThrow: () => ({ rpcUrl: "https://rpc.example" }),
}));

describe("EvmGiftAdapter", () => {
  beforeEach(() => {
    walletConnect.mockReset();
    contractGetPacket.mockReset().mockResolvedValue({ id: "packet" });
  });

  it("queries packet state without connecting a wallet", async () => {
    const { EvmGiftAdapter } = await import("./adapter");
    const adapter = new EvmGiftAdapter();

    await expect(adapter.getPacket("packet")).resolves.toEqual({ id: "packet" });
    expect(walletConnect).not.toHaveBeenCalled();
  });
});
