import { describe, expect, it, vi } from "vitest";
import { createGetGiftPacketByShareCode } from "./route";

const packet = {
  packetId: `0x${"11".repeat(32)}`,
  shareCode: "3kP9xQ7m",
  creatorAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  chainId: 1776,
  contractAddress: "0x1234567890123456789012345678901234567890",
  createTxHash: `0x${"22".repeat(32)}`,
  createdBlockNumber: "123",
  createdBlockTimestamp: "2026-07-19T00:00:00.000Z",
};

describe("GET /api/gift/packets/[shareCode]", () => {
  it("returns the packet behind a valid share code", async () => {
    const getByShareCode = vi.fn().mockResolvedValue(packet);
    const handler = createGetGiftPacketByShareCode({
      getByShareCode,
      getByPacketId: vi.fn(),
    });
    const response = await handler("3kP9xQ7m");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ packet });
  });

  it("returns 404 for an unknown share code", async () => {
    const handler = createGetGiftPacketByShareCode({
      getByShareCode: vi.fn().mockResolvedValue(null),
      getByPacketId: vi.fn(),
    });
    const response = await handler("3kP9xQ7m");
    expect(response.status).toBe(404);
  });

  it("rejects malformed share codes", async () => {
    const getByShareCode = vi.fn();
    const handler = createGetGiftPacketByShareCode({
      getByShareCode,
      getByPacketId: vi.fn(),
    });
    const response = await handler("bad");
    expect(response.status).toBe(400);
    expect(getByShareCode).not.toHaveBeenCalled();
  });

  it("returns the indexed contract for a full packet ID", async () => {
    const getByPacketId = vi.fn().mockResolvedValue(packet);
    const handler = createGetGiftPacketByShareCode({
      getByShareCode: vi.fn(),
      getByPacketId,
    });
    const response = await handler(packet.packetId);

    expect(response.status).toBe(200);
    expect(getByPacketId).toHaveBeenCalledWith(packet.packetId);
  });
});
