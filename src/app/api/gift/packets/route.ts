import { z } from "zod";
import { getGiftPool } from "@/server/gift/db";
import { getGiftServerConfig } from "@/server/gift/config";
import {
  listGiftPackets,
  upsertGiftPacket,
  type GiftPacketRecord,
} from "@/server/gift/packetRepository";
import { createGiftChainReader, GiftVerificationError, verifyCreatedPacket } from "@/server/gift/verifyCreatedPacket";

export const runtime = "nodejs";

const bodySchema = z.object({
  packetId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
}).strict();

type Dependencies = {
  verify(input: { packetId: string; txHash: string }): Promise<GiftPacketRecord>;
  upsert(record: GiftPacketRecord): Promise<GiftPacketRecord>;
};

type GetDependencies = {
  list(creatorAddress: string): Promise<GiftPacketRecord[]>;
};

export function createPostGiftPacket(dependencies: Dependencies) {
  return async function post(request: Request): Promise<Response> {
    try {
      const parsed = bodySchema.safeParse(await request.json());
      if (!parsed.success) {
        return Response.json({ error: { code: "INVALID_INPUT", message: "Invalid packet creation reference" } }, { status: 400 });
      }
      const verified = await dependencies.verify(parsed.data);
      const packet = await dependencies.upsert(verified);
      return Response.json({ packet }, { status: 201 });
    } catch (error) {
      if (error instanceof GiftVerificationError) {
        return Response.json({ error: { code: error.code, message: error.message } }, { status: 422 });
      }
      console.error("[inj-gift] packet persistence failed", error);
      return Response.json({ error: { code: "PERSISTENCE_UNAVAILABLE", message: "Packet persistence is temporarily unavailable" } }, { status: 503 });
    }
  };
}

const creatorSchema = z.string().regex(/^0x[a-f0-9]{40}$/i);

export function createGetGiftPackets(dependencies: GetDependencies) {
  return async function get(request: Request): Promise<Response> {
    const parsed = creatorSchema.safeParse(
      new URL(request.url).searchParams.get("creator"),
    );
    if (!parsed.success) {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: "Invalid creator address" } },
        { status: 400 },
      );
    }
    try {
      const packets = await dependencies.list(parsed.data.toLowerCase());
      return Response.json({ packets });
    } catch (error) {
      console.error("[inj-gift] packet listing failed", error);
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

export async function POST(request: Request): Promise<Response> {
  const config = getGiftServerConfig();
  const reader = createGiftChainReader(config);
  return createPostGiftPacket({
    verify: (input) => verifyCreatedPacket(input as { packetId: `0x${string}`; txHash: `0x${string}` }, config, reader),
    upsert: (record) => upsertGiftPacket(getGiftPool(), record),
  })(request);
}

export async function GET(request: Request): Promise<Response> {
  return createGetGiftPackets({
    list: (creatorAddress) =>
      listGiftPackets(getGiftPool(), creatorAddress),
  })(request);
}
