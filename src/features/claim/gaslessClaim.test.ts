import { describe, expect, it, vi } from "vitest";
import type { GiftAdapter } from "@/domain/giftAdapter";
import { claimPacketGasless, claimPacketReference } from "./gaslessClaim";

describe("claimPacketGasless", () => {
  it("signs a claimer-bound permit and sends it to the relayer", async () => {
    const address = "0x1111111111111111111111111111111111111111";
    const contractAddress = "0x294cDD0Ac5B2ef8b23E2dc3A993E133356Ee72D5";
    const packetId = `0x${"22".repeat(32)}`;
    const request = vi.fn().mockResolvedValue(`0x${"33".repeat(65)}`);
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({ transactionHash: `0x${"44".repeat(32)}` }),
    );

    const result = await claimPacketGasless(
      { packetId, password: "lucky", contractAddress, chainId: 1776 },
      {
        connect: vi.fn().mockResolvedValue({ address, provider: { request } }),
        readNonce: vi.fn().mockResolvedValue(7n),
        fetcher,
        now: () => 2_000_000_000_000,
        relayerUrl: "/api/gift/claims/relay",
      },
    );

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "eth_signTypedData_v4",
    }));
    const typedData = JSON.parse(request.mock.calls[0][0].params[1]);
    expect(typedData.message).toMatchObject({
      id: packetId,
      claimer: address,
      nonce: "7",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/gift/claims/relay",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.hash).toBe(`0x${"44".repeat(32)}`);
  });
});

describe("claimPacketReference", () => {
  it("resolves a share code and uses the relayer for indexed contracts", async () => {
    const contractAddress = "0x294cDD0Ac5B2ef8b23E2dc3A993E133356Ee72D5";
    const adapter = {
      claimPacket: vi.fn(),
    } as unknown as GiftAdapter;
    const claimGasless = vi.fn().mockResolvedValue({ hash: "0xgasless" });

    const result = await claimPacketReference(
      { reference: "4ERuUi6m", password: "lucky", adapter },
      {
        currentContractAddress: contractAddress,
        resolveReference: vi.fn().mockResolvedValue({
          packetId: `0x${"22".repeat(32)}`,
          contractAddress,
          chainId: 1776,
        }),
        claimGasless,
      },
    );

    expect(claimGasless).toHaveBeenCalledWith({
      packetId: `0x${"22".repeat(32)}`,
      password: "lucky",
      contractAddress,
      chainId: 1776,
    });
    expect(adapter.claimPacket).not.toHaveBeenCalled();
    expect(result).toEqual({
      hash: "0xgasless",
      packetId: `0x${"22".repeat(32)}`,
    });
  });

  it("keeps full legacy packet IDs on the direct claim path", async () => {
    const packetId = `0x${"44".repeat(32)}`;
    const adapter = {
      claimPacket: vi.fn().mockResolvedValue({
        hash: "0xdirect",
        claimAmount: "100",
      }),
    } as unknown as GiftAdapter;

    const result = await claimPacketReference(
      { reference: packetId, password: "legacy", adapter },
      {
        resolveReference: vi.fn().mockResolvedValue({ packetId }),
      },
    );

    expect(adapter.claimPacket).toHaveBeenCalledWith(
      { id: packetId, password: "legacy" },
      undefined,
    );
    expect(result).toMatchObject({
      hash: "0xdirect",
      packetId,
      claimAmount: "100",
    });
  });

  it("uses the indexed legacy contract instead of the current gasless contract", async () => {
    const packetId = `0x${"55".repeat(32)}`;
    const legacyContract = "0x1111111111111111111111111111111111111111";
    const adapter = {
      claimPacket: vi.fn().mockResolvedValue({ hash: "0xlegacy" }),
    } as unknown as GiftAdapter;
    const claimGasless = vi.fn();

    await claimPacketReference(
      { reference: packetId, password: "legacy", adapter },
      {
        currentContractAddress: "0x2222222222222222222222222222222222222222",
        resolveReference: vi.fn().mockResolvedValue({
          packetId,
          contractAddress: legacyContract,
          chainId: 1776,
        }),
        claimGasless,
      },
    );

    expect(claimGasless).not.toHaveBeenCalled();
    expect(adapter.claimPacket).toHaveBeenCalledWith(
      { id: packetId, password: "legacy" },
      legacyContract,
    );
  });
});
