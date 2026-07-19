import { describe, expect, it, vi } from "vitest";
import { listGiftPackets, upsertGiftPacket } from "./packetRepository";

const record = {
  packetId: `0x${"11".repeat(32)}`,
  creatorAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  chainId: 1439,
  contractAddress: "0x1234567890123456789012345678901234567890",
  createTxHash: `0x${"22".repeat(32)}`,
  createdBlockNumber: "123",
  createdBlockTimestamp: "2026-07-19T00:00:00.000Z",
};

describe("gift packet repository", () => {
  it("upserts the normalized chain identity", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [record] });

    await upsertGiftPacket({ query }, record);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "gift-packets"'),
      expect.arrayContaining([record.packetId, record.creatorAddress]),
    );
  });

  it("lists one normalized creator newest first", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await listGiftPackets({ query }, record.creatorAddress.toUpperCase());

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY created_block_timestamp DESC"),
      [record.creatorAddress],
    );
  });
});
