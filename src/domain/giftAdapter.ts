import type {
  ClaimPacketInput,
  CreatePacketInput,
  GiftPacket,
  Stack,
  TxResult,
} from "./types";

export interface GiftAdapter {
  stack: Stack;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAddress(): Promise<string | null>;

  getPacket(id: string): Promise<GiftPacket>;
  createPacket(input: CreatePacketInput): Promise<TxResult>;
  claimPacket(input: ClaimPacketInput): Promise<TxResult>;
  refundPacket(id: string): Promise<TxResult>;
}

