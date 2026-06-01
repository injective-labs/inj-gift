import { PacketInfo } from "../../../types/packet";

export type PacketStatus =
  | "active"
  | "expired"
  | "claimed_out"
  | "inactive";

export interface PacketSummary {
  id: string;
  creator: string;
  totalAmount: string;
  claimedAmount: string;
  totalCount: number;
  claimedCount: number;
  denomOrCw20: string;
  mode: string;
  expiresAt: number;
  status: PacketStatus;
  isActive?: boolean;
}

export interface ClaimResult {
  packetId: string;
  claimer: string;
  amount: string;
  txHash: string;
  timestamp: number;
}

export interface CreatePacketInput {
  totalAmount: string;
  denomOrCw20: string;
  count: number;
  passwordHash: string;
  expiresAt: number;
  mode: string;
}

/**
 * Derive high-level status from raw PacketInfo.
 */
export const deriveStatus = (
  info: PacketInfo,
  nowTs: number = Math.floor(Date.now() / 1000)
): PacketStatus => {
  if (nowTs > info.expires_at) return "expired";
  if (info.claimed_count >= info.count) return "claimed_out";
  return "active";
};

/**
 * Normalise contract PacketInfo into PacketSummary
 */
export const mapToSummary = (
  id: string,
  info: PacketInfo,
  nowTs?: number
): PacketSummary => ({
  id,
  creator: info.creator,
  totalAmount: info.total_amount,
  claimedAmount: info.claimed_amount,
  totalCount: info.count,
  claimedCount: info.claimed_count,
  denomOrCw20: info.denom_or_cw20,
  mode: info.mode,
  expiresAt: info.expires_at,
  status: deriveStatus(info, nowTs),
});






