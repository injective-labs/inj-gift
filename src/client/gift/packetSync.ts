export type PacketSyncItem = { packetId: string; txHash: string };
export type SyncedPacket = PacketSyncItem & {
  shareCode?: string;
  [key: string]: unknown;
};

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
): Promise<SyncedPacket | null> {
  try {
    const response = await fetcher("/api/gift/packets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      queue(item);
      return null;
    }
    const payload = (await response.json()) as { packet?: SyncedPacket };
    return payload.packet ?? null;
  } catch {
    queue(item);
    return null;
  }
}

export async function flushPacketSyncOutbox(
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (typeof window === "undefined") return;
  let items: PacketSyncItem[];
  try {
    items = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]") as PacketSyncItem[];
  } catch {
    localStorage.removeItem(OUTBOX_KEY);
    return;
  }
  const remaining: PacketSyncItem[] = [];
  for (const item of items) {
    if (!(await syncCreatedPacket(item, fetcher))) {
      remaining.push(item);
    }
  }
  if (remaining.length) {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining));
  } else {
    localStorage.removeItem(OUTBOX_KEY);
  }
}
