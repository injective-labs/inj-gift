// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPacketSyncOutbox, syncCreatedPacket } from "./packetSync";

const item = { packetId: `0x${"11".repeat(32)}`, txHash: `0x${"22".repeat(32)}` };

describe("syncCreatedPacket", () => {
  beforeEach(() => localStorage.clear());

  it("posts the created packet to the project API", async () => {
    const packet = { ...item, shareCode: "3kP9xQ7m" };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ packet }, { status: 201 }));
    await expect(syncCreatedPacket(item, fetcher)).resolves.toEqual(packet);
    expect(fetcher).toHaveBeenCalledWith("/api/gift/packets", expect.objectContaining({ method: "POST" }));
  });

  it("queues the packet locally when persistence fails", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 503 }));
    await expect(syncCreatedPacket(item, fetcher)).resolves.toBeNull();
    expect(JSON.parse(localStorage.getItem("injgift.packetSyncOutbox") ?? "[]")).toEqual([item]);
  });

  it("retries queued packets and removes successful entries", async () => {
    localStorage.setItem("injgift.packetSyncOutbox", JSON.stringify([item]));
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({ packet: { ...item, shareCode: "3kP9xQ7m" } }),
    );

    await flushPacketSyncOutbox(fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(localStorage.getItem("injgift.packetSyncOutbox")).toBeNull();
  });
});
