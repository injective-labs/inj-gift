import { describe, expect, it, vi } from "vitest";
import type { GiftAdapter } from "@/domain/giftAdapter";
import { createInjGiftAgentMessageHandler, executeInjGiftAgentCommand } from "@/wallet/injpass/agentBridge";

function adapter(): GiftAdapter {
  return {
    stack: "evm",
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getAddress: vi.fn().mockResolvedValue("0x1111111111111111111111111111111111111111"),
    createPacket: vi.fn().mockResolvedValue({
      hash: "0xcreate",
      stack: "evm",
      packetId: `0x${"ab".repeat(32)}`,
    }),
    claimPacket: vi.fn().mockResolvedValue({ hash: "0xclaim", stack: "evm", claimAmount: "1000000000000000" }),
    getPacket: vi.fn().mockResolvedValue({
      id: `0x${"ab".repeat(32)}`,
      creator: "0x1111111111111111111111111111111111111111",
      token: "0x0000000000000000000000000000000000000000",
      totalAmount: "10000000000000000",
      totalCount: 2,
      claimedAmount: "0",
      claimedCount: 0,
      expiration: 9999999999,
      mode: "random",
      isActive: true,
    }),
    refundPacket: vi.fn(),
  };
}

const session = {
  authenticated: true,
  address: "0x1111111111111111111111111111111111111111",
  chainId: 1439,
};

describe("executeInjGiftAgentCommand", () => {
  it("creates a native INJ packet through the shared adapter", async () => {
    const gift = adapter();
    const syncCreated = vi.fn().mockResolvedValue({ shareCode: "4ERuUi6m" });
    const result = await executeInjGiftAgentCommand({
      appId: "inj-gift",
      action: "create",
      params: { amount: "0.01", count: 2, password: "lucky", durationSec: 3600, mode: "random" },
    }, {
      adapter: gift,
      session,
      syncCreated,
      shareOrigin: "https://gift.example",
    });

    expect(gift.createPacket).toHaveBeenCalledWith(expect.objectContaining({
      amount: "10000000000000000",
      count: 2,
      password: "lucky",
    }));
    expect(syncCreated).toHaveBeenCalledWith({
      packetId: `0x${"ab".repeat(32)}`,
      txHash: "0xcreate",
    });
    expect(result).toMatchObject({
      ok: true,
      key: "inj_gift_created",
      data: {
        transactionHash: "0xcreate",
        shareCode: "4ERuUi6m",
        shareUrl: "https://gift.example/claim/4ERuUi6m#passcode=lucky",
      },
    });
  });

  it("claims a packet and returns the claimed amount", async () => {
    const gift = adapter();
    const packetId = `0x${"ab".repeat(32)}`;
    const result = await executeInjGiftAgentCommand({
      appId: "inj-gift",
      action: "claim",
      params: { packetReference: "4ERuUi6m", password: "lucky" },
    }, {
      adapter: gift,
      session,
      claimReference: vi.fn().mockResolvedValue({
        hash: "0xgasless",
        packetId,
      }),
    });

    expect(gift.claimPacket).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      key: "inj_gift_claimed",
      data: { transactionHash: "0xgasless", packetId },
    });
  });

  it("resolves a short link before querying packet state", async () => {
    const gift = adapter();
    const packetId = `0x${"ab".repeat(32)}`;
    const resolveReference = vi.fn().mockResolvedValue({ packetId });
    const result = await executeInjGiftAgentCommand({
      appId: "inj-gift",
      action: "query",
      params: { packetReference: "https://gift.example/claim/4ERuUi6m" },
    }, { adapter: gift, session: null, resolveReference });

    expect(resolveReference).toHaveBeenCalledWith("https://gift.example/claim/4ERuUi6m");
    expect(gift.getPacket).toHaveBeenCalledWith(packetId, undefined);
    expect(gift.connect).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, key: "inj_gift_packet" });
  });

  it("requires the host wallet for transaction commands", async () => {
    const result = await executeInjGiftAgentCommand({
      appId: "inj-gift",
      action: "create",
      params: { amount: "0.01", count: 1, password: "lucky" },
    }, { adapter: adapter(), session: null });

    expect(result).toEqual({ ok: false, key: "login_required" });
  });

  it("accepts agent commands only from the configured parent", async () => {
    const parent = {} as WindowProxy;
    const post = vi.fn();
    const gift = adapter();
    const handler = createInjGiftAgentMessageHandler({
      parent,
      origin: "https://www.injpass.com",
      adapter: gift,
      getSession: () => session,
      post,
      claimReference: vi.fn().mockResolvedValue({
        hash: "0xclaim",
        packetId: `0x${"ab".repeat(32)}`,
        claimAmount: "1000000000000000",
      }),
    });
    const command = {
      channel: "injpass-miniapp-v1",
      type: "agent-command",
      id: "command-1",
      command: {
        appId: "inj-gift",
        action: "claim",
        params: { packetReference: `0x${"ab".repeat(32)}`, password: "lucky" },
      },
    };

    await handler({ source: parent, origin: "https://evil.example", data: command } as MessageEvent);
    expect(post).not.toHaveBeenCalled();

    await handler({ source: parent, origin: "https://www.injpass.com", data: command } as MessageEvent);
    expect(post).toHaveBeenCalledWith(expect.objectContaining({
      type: "agent-command-result",
      id: "command-1",
      result: expect.objectContaining({ key: "inj_gift_claimed" }),
    }));
  });
});
