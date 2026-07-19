export type PacketSyncItem = { packetId: string; txHash: string };

const OUTBOX_KEY = "injgift.packetSyncOutbox";

function queue(item: PacketSyncItem) {
  if (typeof window === "undefined") return;
  try {
    const current = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]") as PacketSyncItem[];
    if (!current.some((entry) => entry.packetId === item.packetId && entry.txHash === item.txHash)) {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify([...current, item]));
    }
  } catch {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([item]));
  }
}

export async function syncCreatedPacket(
  item: PacketSyncItem,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetcher("/api/gift/packets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      queue(item);
      return false;
    }
    return true;
  } catch {
    queue(item);
    return false;
  }
}
