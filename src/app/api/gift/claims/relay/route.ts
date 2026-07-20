import { z } from "zod";
import {
  GiftRelayError,
  relayGiftClaim,
  type RelayClaimInput,
} from "@/server/gift/relayer";

export const runtime = "nodejs";

const schema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  packetId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  pwdHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  claimer: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  nonce: z.string().regex(/^\d+$/),
  deadline: z.string().regex(/^\d+$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
}).strict();

type Dependencies = {
  relay(input: RelayClaimInput): Promise<{ transactionHash: string }>;
};

export function createRelayGiftClaimRoute(dependencies: Dependencies) {
  return async function post(request: Request): Promise<Response> {
    try {
      const input = schema.parse(await request.json());
      return Response.json(await dependencies.relay(input));
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return Response.json(
          { error: { code: "INVALID_INPUT", message: "Invalid relay request" } },
          { status: 400 },
        );
      }
      if (error instanceof GiftRelayError) {
        return Response.json(
          { error: { code: "RELAY_REJECTED", message: error.message } },
          { status: error.status },
        );
      }
      console.error("[inj-gift] claim relay failed", error);
      return Response.json(
        { error: { code: "RELAY_UNAVAILABLE", message: "Claim relay is unavailable" } },
        { status: 503 },
      );
    }
  };
}

export const POST = createRelayGiftClaimRoute({ relay: relayGiftClaim });
