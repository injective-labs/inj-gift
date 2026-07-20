import { describe, expect, it, vi } from "vitest";
import { fetchMyPackets, resolvePacketReference } from "./client";

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

describe("my packets client", () => {
  it("fetches packets for one wallet", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ packets: [packet] }));
    await expect(fetchMyPackets(packet.creatorAddress, fetcher)).resolves.toEqual([packet]);
    expect(fetcher).toHaveBeenCalledWith(
      `/api/gift/packets?creator=${encodeURIComponent(packet.creatorAddress)}`,
    );
  });

  it("resolves a share URL through the packet API", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ packet }));
    await expect(
      resolvePacketReference(
        "https://gift.injpass.com/claim/3kP9xQ7m",
        fetcher,
      ),
    ).resolves.toEqual(packet);
    expect(fetcher).toHaveBeenCalledWith("/api/gift/packets/3kP9xQ7m");
  });

  it("resolves an indexed full packet ID to its legacy contract", async () => {
    const packetId = packet.packetId;
    const fetcher = vi.fn().mockResolvedValue(Response.json({ packet }));
    await expect(resolvePacketReference(packetId, fetcher)).resolves.toEqual(packet);
    expect(fetcher).toHaveBeenCalledWith(`/api/gift/packets/${packetId}`);
  });

  it("keeps an unindexed full packet ID on the configured legacy fallback", async () => {
    const packetId = packet.packetId;
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(resolvePacketReference(packetId, fetcher)).resolves.toEqual({ packetId });
  });
});
