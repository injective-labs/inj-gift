import { getGiftPool } from "@/server/gift/db";
import {
  getGiftPacketByPacketId,
  getGiftPacketByShareCode,
  type GiftPacketRecord,
} from "@/server/gift/packetRepository";
import { isShareCode } from "@/server/gift/shareCode";

export const runtime = "nodejs";

type Dependencies = {
  getByShareCode(shareCode: string): Promise<GiftPacketRecord | null>;
  getByPacketId(packetId: string): Promise<GiftPacketRecord | null>;
};

const FULL_PACKET_ID = /^0x[a-fA-F0-9]{64}$/;

export function createGetGiftPacketByShareCode(dependencies: Dependencies) {
  return async function get(shareCode: string): Promise<Response> {
    if (!isShareCode(shareCode) && !FULL_PACKET_ID.test(shareCode)) {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: "Invalid share code" } },
        { status: 400 },
      );
    }
    try {
      const packet = FULL_PACKET_ID.test(shareCode)
        ? await dependencies.getByPacketId(shareCode)
        : await dependencies.getByShareCode(shareCode);
      if (!packet) {
        return Response.json(
          { error: { code: "PACKET_NOT_FOUND", message: "Packet not found" } },
          { status: 404 },
        );
      }
      return Response.json({ packet });
    } catch (error) {
      console.error("[inj-gift] share code lookup failed", error);
      return Response.json(
        {
          error: {
            code: "PERSISTENCE_UNAVAILABLE",
            message: "Packet persistence is temporarily unavailable",
          },
        },
        { status: 503 },
      );
    }
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareCode: string }> },
): Promise<Response> {
  const { shareCode } = await context.params;
  return createGetGiftPacketByShareCode({
    getByShareCode: (code) => getGiftPacketByShareCode(getGiftPool(), code),
    getByPacketId: (packetId) => getGiftPacketByPacketId(getGiftPool(), packetId),
  })(shareCode);
}
