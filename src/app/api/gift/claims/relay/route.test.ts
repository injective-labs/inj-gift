import { describe, expect, it, vi } from "vitest";
import { createRelayGiftClaimRoute } from "./route";

const input = {
  contractAddress: "0x5373A185ee8017eeDD8bF51C009f5A1F058A8D02",
  packetId: `0x${"11".repeat(32)}`,
  pwdHash: `0x${"22".repeat(32)}`,
  claimer: "0x1111111111111111111111111111111111111111",
  nonce: "0",
  deadline: "2000000000",
  signature: `0x${"33".repeat(65)}`,
};

describe("POST /api/gift/claims/relay", () => {
  it("relays a validated claim through the INJ Gift server", async () => {
    const relay = vi.fn().mockResolvedValue({ transactionHash: "0xrelay" });
    const response = await createRelayGiftClaimRoute({ relay })(
      new Request("https://gift.example/api/gift/claims/relay", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ transactionHash: "0xrelay" });
    expect(relay).toHaveBeenCalledWith(input);
  });

  it("rejects arbitrary targets and malformed calldata fields", async () => {
    const relay = vi.fn();
    const response = await createRelayGiftClaimRoute({ relay })(
      new Request("https://gift.example/api/gift/claims/relay", {
        method: "POST",
        body: JSON.stringify({ ...input, contractAddress: "bad", calldata: "0x1234" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(relay).not.toHaveBeenCalled();
  });

  it("returns the safe relayer rejection reason", async () => {
    const response = await createRelayGiftClaimRoute({
      relay: vi.fn().mockRejectedValue(
        Object.assign(new Error("Claim permit nonce is stale"), {
          name: "GiftRelayError",
          status: 400,
        }),
      ),
    })(
      new Request("https://gift.example/api/gift/claims/relay", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "RELAY_REJECTED",
        message: "Claim permit nonce is stale",
      },
    });
  });
});
