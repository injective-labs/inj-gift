import { createPublicClient, decodeEventLog, http, type Address, type Hex } from "viem";
import abi from "@/lib/abi/InjGift.json";
import type { GiftPacketRecord } from "./packetRepository";
import type { GiftServerConfig } from "./config";

export type GiftChainReader = {
  getTransaction(hash: Hex): Promise<{ to: Address | null }>;
  getTransactionReceipt(hash: Hex): Promise<{
    status: "success" | "reverted";
    blockNumber: bigint;
    logs: Array<{ address: Address; eventName?: string; args?: { id?: Hex; creator?: Address }; topics?: readonly Hex[]; data?: Hex }>;
  }>;
  getBlock(blockNumber: bigint): Promise<{ timestamp: bigint }>;
  readPacketCreator(packetId: Hex): Promise<Address>;
};

export class GiftVerificationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "GiftVerificationError";
  }
}

const same = (left: string | null | undefined, right: string) => left?.toLowerCase() === right.toLowerCase();

export async function verifyCreatedPacket(
  input: { packetId: Hex; txHash: Hex },
  config: GiftServerConfig,
  reader: GiftChainReader,
): Promise<GiftPacketRecord> {
  const transaction = await reader.getTransaction(input.txHash);
  if (!same(transaction.to, config.contractAddress)) {
    throw new GiftVerificationError("WRONG_CONTRACT", "Transaction targets another contract");
  }

  const receipt = await reader.getTransactionReceipt(input.txHash);
  if (receipt.status !== "success") {
    throw new GiftVerificationError("TRANSACTION_FAILED", "Transaction was not successful");
  }

  const event = receipt.logs.find((log) =>
    same(log.address, config.contractAddress) &&
    log.eventName === "RedPacketCreated" &&
    same(log.args?.id, input.packetId),
  );
  if (!event?.args?.creator) {
    throw new GiftVerificationError("CREATION_EVENT_NOT_FOUND", "Matching creation event not found");
  }

  const contractCreator = await reader.readPacketCreator(input.packetId);
  if (!same(contractCreator, event.args.creator)) {
    throw new GiftVerificationError("CREATOR_MISMATCH", "Contract creator does not match the event");
  }
  const block = await reader.getBlock(receipt.blockNumber);

  return {
    packetId: input.packetId,
    creatorAddress: contractCreator.toLowerCase(),
    chainId: config.chainId,
    contractAddress: config.contractAddress.toLowerCase(),
    createTxHash: input.txHash,
    createdBlockNumber: receipt.blockNumber.toString(),
    createdBlockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
  };
}

export function createGiftChainReader(config: Required<GiftServerConfig>): GiftChainReader {
  const client = createPublicClient({ transport: http(config.rpcUrl) });
  return {
    getTransaction: (hash) => client.getTransaction({ hash }),
    async getTransactionReceipt(hash) {
      const receipt = await client.getTransactionReceipt({ hash });
      const logs = receipt.logs.map((log) => {
        try {
          const decoded = decodeEventLog({ abi, eventName: "RedPacketCreated", data: log.data, topics: log.topics });
          return { ...log, eventName: decoded.eventName, args: decoded.args as { id?: Hex; creator?: Address } };
        } catch {
          return log;
        }
      });
      return { status: receipt.status, blockNumber: receipt.blockNumber, logs };
    },
    getBlock: (blockNumber) => client.getBlock({ blockNumber }),
    async readPacketCreator(packetId) {
      const packet = await client.readContract({
        address: config.contractAddress,
        abi,
        functionName: "redPackets",
        args: [packetId],
      }) as readonly [Address, ...unknown[]];
      return packet[0];
    },
  };
}
