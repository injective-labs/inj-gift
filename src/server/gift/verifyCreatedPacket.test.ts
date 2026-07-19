import { describe, expect, it, vi } from "vitest";
import { verifyCreatedPacket, type GiftChainReader } from "./verifyCreatedPacket";

const packetId = `0x${"11".repeat(32)}` as `0x${string}`;
const txHash = `0x${"22".repeat(32)}` as `0x${string}`;
const contract = "0x1234567890123456789012345678901234567890" as const;
const creator = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;

function reader(overrides: Partial<GiftChainReader> = {}): GiftChainReader {
  return {
    getTransaction: vi.fn().mockResolvedValue({ to: contract }),
    getTransactionReceipt: vi.fn().mockResolvedValue({
      status: "success",
      blockNumber: 123n,
      logs: [{ address: contract, eventName: "RedPacketCreated", args: { id: packetId, creator } }],
    }),
    getBlock: vi.fn().mockResolvedValue({ timestamp: 1_750_000_000n }),
    readPacketCreator: vi.fn().mockResolvedValue(creator),
    ...overrides,
  };
}

describe("verifyCreatedPacket", () => {
  it("derives the database record from confirmed chain data", async () => {
    await expect(verifyCreatedPacket(
      { packetId, txHash },
      { chainId: 1776, contractAddress: contract },
      reader(),
    )).resolves.toMatchObject({
      packetId,
      createTxHash: txHash,
      creatorAddress: creator,
      chainId: 1776,
      contractAddress: contract,
      createdBlockNumber: "123",
    });
  });

  it("rejects a transaction sent to another contract", async () => {
    await expect(verifyCreatedPacket(
      { packetId, txHash },
      { chainId: 1776, contractAddress: contract },
      reader({ getTransaction: vi.fn().mockResolvedValue({ to: creator }) }),
    )).rejects.toMatchObject({ code: "WRONG_CONTRACT" });
  });

  it("rejects a receipt without the matching creation event", async () => {
    await expect(verifyCreatedPacket(
      { packetId, txHash },
      { chainId: 1776, contractAddress: contract },
      reader({ getTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", blockNumber: 123n, logs: [] }) }),
    )).rejects.toMatchObject({ code: "CREATION_EVENT_NOT_FOUND" });
  });
});
