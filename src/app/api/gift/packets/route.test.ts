import { describe, expect, it, vi } from "vitest";
import { createPostGiftPacket } from "./route";

const packetId = `0x${"11".repeat(32)}`;
const txHash = `0x${"22".repeat(32)}`;
const packet = {
  packetId,
  creatorAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  chainId: 1776,
  contractAddress: "0x1234567890123456789012345678901234567890",
  createTxHash: txHash,
  createdBlockNumber: "123",
  createdBlockTimestamp: "2026-07-19T00:00:00.000Z",
};

describe("POST /api/gift/packets", () => {
  it("persists only the chain-verified record", async () => {
    const verify = vi.fn().mockResolvedValue(packet);
    const upsert = vi.fn().mockResolvedValue(packet);
    const handler = createPostGiftPacket({ verify, upsert });
    const response = await handler(new Request("http://localhost/api/gift/packets", {
      method: "POST",
      body: JSON.stringify({ packetId, txHash }),
    }));

    expect(response.status).toBe(201);
    expect(verify).toHaveBeenCalledWith({ packetId, txHash });
    expect(upsert).toHaveBeenCalledWith(packet);
  });

  it("rejects browser-supplied creator data", async () => {
    const handler = createPostGiftPacket({ verify: vi.fn(), upsert: vi.fn() });
    const response = await handler(new Request("http://localhost/api/gift/packets", {
      method: "POST",
      body: JSON.stringify({ packetId, txHash, creator: packet.creatorAddress }),
    }));
    expect(response.status).toBe(400);
  });
});
