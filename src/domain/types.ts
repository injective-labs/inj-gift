import { PacketStatus } from "@/features/redpacket/domain/types";

export type HexAddress = `0x${string}`;

export type Stack = "evm" | "wasm";

export type DistributionMode = "random" | "equal";

export type GiftPacket = {
  id: string;
  creator: string;
  token: string; // for EVM: 0x0 native; for wasm: denom or cw20
  totalAmount: string;
  totalCount: number;
  claimedAmount: string;
  claimedCount: number;
  expiration: number;
  mode: DistributionMode;
  isActive: boolean;
  status?: PacketStatus;
};

export type CreatePacketInput = {
  token: string; // EVM: address(0) for native; WASM: denom or cw20
  amount: string; // base units
  count: number;
  password: string;
  durationSec: number;
  mode: DistributionMode;
};

export type ClaimPacketInput = {
  id: string;
  password: string;
};

export type TxResult = {
  hash: string;
  stack: Stack;
  packetId?: string;
  receipt?: unknown;
  claimAmount?: string;
};

