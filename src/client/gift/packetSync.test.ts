// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncCreatedPacket } from "./packetSync";

const item = { packetId: `0x${"11".repeat(32)}`, txHash: `0x${"22".repeat(32)}` };

describe("syncCreatedPacket", () => {
  beforeEach(() => localStorage.clear());

  it("posts the created packet to the project API", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    await expect(syncCreatedPacket(item, fetcher)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith("/api/gift/packets", expect.objectContaining({ method: "POST" }));
  });

  it("queues the packet locally when persistence fails", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 503 }));
    await expect(syncCreatedPacket(item, fetcher)).resolves.toBe(false);
    expect(JSON.parse(localStorage.getItem("injgift.packetSyncOutbox") ?? "[]")).toEqual([item]);
  });
});
