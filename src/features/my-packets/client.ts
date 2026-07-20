import type { GiftPacketIndex } from "./types";

const FULL_PACKET_ID = /^0x[a-fA-F0-9]{64}$/;
const SHARE_CODE = /^[1-9A-HJ-NP-Za-km-z]{8}$/;

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Gift packet API returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchMyPackets(
  creatorAddress: string,
  fetcher: typeof fetch = fetch,
): Promise<GiftPacketIndex[]> {
  const response = await fetcher(
    `/api/gift/packets?creator=${encodeURIComponent(creatorAddress)}`,
  );
  return (await readJson<{ packets: GiftPacketIndex[] }>(response)).packets;
}

function extractReference(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  } catch {
    return trimmed;
  }
}

export async function resolvePacketReference(
  reference: string,
  fetcher: typeof fetch = fetch,
): Promise<GiftPacketIndex> {
  const value = extractReference(reference);
  if (!FULL_PACKET_ID.test(value) && !SHARE_CODE.test(value)) {
    throw new Error("Invalid gift packet reference");
  }
  const response = await fetcher(`/api/gift/packets/${value}`);
  if (FULL_PACKET_ID.test(value) && response.status === 404) {
    return { packetId: value };
  }
  return (await readJson<{ packet: GiftPacketIndex }>(response)).packet;
}
