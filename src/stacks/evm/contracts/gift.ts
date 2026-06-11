import { ethers, Contract, BrowserProvider, Signer } from "ethers";
import { appError } from "@/domain/errors";
import type { DistributionMode, GiftPacket } from "@/domain/types";
import { injGiftAddress } from "../config";
import abiRaw from "@/lib/abi/InjGift.json";

const abi = abiRaw;

type TxLike = { hash: string; wait?: () => Promise<{ logs?: Array<unknown> }> };

export class InjGiftContractWrapper {
  private contract: Contract;

  constructor(private signerOrProvider: Signer | BrowserProvider) {
    if (!injGiftAddress) {
      throw appError(
        "INVALID_INPUT",
        "EVM contract address not configured. Set NEXT_PUBLIC_EVM_CONTRACT_ADDRESS",
      );
    }
    this.contract = new Contract(injGiftAddress, abi, signerOrProvider);
  }

  async getPacket(id: string): Promise<GiftPacket> {
    try {
      // ethers v6 returns a Result that is array-like (and may also have named keys)
      const p = (await this.contract.redPackets(id)) as unknown as Array<unknown>;

      const creator = String(p[0] ?? "");
      const token = String(p[1] ?? "");
      const totalAmount = BigInt(p[2] as any).toString();
      const totalCount = Number(p[3] as any);
      const claimedAmount = BigInt(p[4] as any).toString();
      const claimedCount = Number(p[5] as any);
      const expiration = Number(p[7] as any);
      const modeNum = Number(p[10] as any);
      const isActive = Boolean(p[11]);

      const mode: DistributionMode = modeNum === 0 ? "random" : "equal";

      return {
        id,
        creator,
        token,
        totalAmount,
        totalCount,
        claimedAmount,
        claimedCount,
        expiration,
        mode,
        isActive,
      };
    } catch (e: unknown) {
      if (isRevert(e)) {
        const reason = extractRevertReason(e);
        throw appError("REVERT", reason || "Contract reverted", { cause: e });
      }
      throw appError("RPC_ERROR", "Failed to fetch packet", { cause: e });
    }
  }

  async createPacket(params: {
    token: string;
    amount: string;
    count: number;
    password: string;
    durationSec: number;
    mode: "random" | "equal";
  }): Promise<TxLike & { packetId?: string; receipt?: unknown }> {
    try {
      const modeEnum = params.mode === "random" ? 0 : 1;
      const overrides = params.token === ethers.ZeroAddress
        ? { value: BigInt(params.amount) }
        : {};

      const tx = (await this.contract.createRedPacket(
        params.token,
        BigInt(params.amount),
        BigInt(params.count),
        params.password,
        BigInt(params.durationSec),
        modeEnum,
        overrides,
      )) as TxLike;

      console.log('[inj-gift] createRedPacket tx returned:', {
        hash: tx.hash,
        hasWait: typeof tx.wait === 'function',
        txKeys: Object.keys(tx),
      });

      // Wait for tx to be mined so we can extract packetId from receipt logs.
      // UI stays in "创建中..." until the tx is confirmed on-chain.
      let packetId: string | undefined;
      let receipt: unknown;
      if (tx.wait) {
        receipt = await tx.wait();
        console.log('[inj-gift] tx.wait() resolved, receipt:', receipt);
        packetId = this.extractPacketId(receipt as { logs?: Array<unknown> });
        console.log('[inj-gift] extracted packetId:', packetId);
      } else {
        console.warn('[inj-gift] tx.wait is NOT available — cannot get receipt/packetId');
      }
      return { hash: tx.hash, receipt, packetId };
    } catch (e: unknown) {
      if (isUserRejected(e)) throw appError("USER_REJECTED", "User rejected transaction");
      if (isInsufficientFunds(e)) throw appError("INSUFFICIENT_FUNDS", "Insufficient funds for gas + value");
      if (isRevert(e)) {
        const reason = extractRevertReason(e);
        throw appError("REVERT", reason || "Contract reverted", { cause: e });
      }
      throw appError("RPC_ERROR", "Failed to create packet", { cause: e });
    }
  }

  private extractPacketId(receipt: { logs?: Array<unknown> }): string | undefined {
    if (!receipt?.logs?.length) return undefined;
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog(log as any);
        if (parsed?.name === "RedPacketCreated") {
          const id = (parsed as { args?: Record<string, unknown> }).args?.id;
          if (typeof id === "string") return id;
          if (id) return String(id);
        }
      } catch {
        continue;
      }
    }
    return undefined;
  }

  async claimPacket(params: { id: string; password: string }): Promise<TxLike & { claimAmount?: string; receipt?: unknown }> {
    try {
      const tx = (await this.contract.claim(params.id, params.password)) as TxLike;
      const receipt = tx.wait ? await tx.wait() : undefined;
      const claimAmount = receipt ? this.extractClaimAmount(receipt) : undefined;
      return { hash: tx.hash, receipt, claimAmount };
    } catch (e: unknown) {
      if (isUserRejected(e)) throw appError("USER_REJECTED", "User rejected transaction");
      if (isInsufficientFunds(e)) throw appError("INSUFFICIENT_FUNDS", "Insufficient funds for gas");
      if (isRevert(e)) {
        const reason = extractRevertReason(e);
        throw appError("REVERT", reason || "Contract reverted", { cause: e });
      }
      throw appError("RPC_ERROR", "Failed to claim packet", { cause: e });
    }
  }

  private extractClaimAmount(receipt: { logs?: Array<unknown> }): string | undefined {
    if (!receipt?.logs?.length) return undefined;
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog(log as any);
        if (parsed?.name === "RedPacketClaimed") {
          const amount = (parsed as { args?: Record<string, unknown> }).args?.amount;
          if (typeof amount === "bigint") return amount.toString();
          if (typeof amount === "string") return amount;
          if (amount) return String(amount);
        }
      } catch {
        continue;
      }
    }
    return undefined;
  }

  async refundPacket(id: string): Promise<TxLike & { receipt?: unknown }> {
    try {
      const tx = (await this.contract.refund(id)) as TxLike;
      const receipt = tx.wait ? await tx.wait() : undefined;
      return { hash: tx.hash, receipt };
    } catch (e: unknown) {
      if (isUserRejected(e)) throw appError("USER_REJECTED", "User rejected transaction");
      if (isInsufficientFunds(e)) throw appError("INSUFFICIENT_FUNDS", "Insufficient funds for gas");
      if (isRevert(e)) {
        const reason = extractRevertReason(e);
        throw appError("REVERT", reason || "Contract reverted", { cause: e });
      }
      throw appError("RPC_ERROR", "Failed to refund packet", { cause: e });
    }
  }
}

function isUserRejected(e: unknown): boolean {
  if (e && typeof e === "object") {
    const anyE = e as Record<string, unknown>;
    return (
      anyE.code === 4001 ||
      (typeof anyE.message === "string" && anyE.message.toLowerCase().includes("user rejected"))
    );
  }
  return false;
}

function isInsufficientFunds(e: unknown): boolean {
  if (e && typeof e === "object") {
    const anyE = e as Record<string, unknown>;
    return (
      anyE.code === -32603 ||
      (typeof anyE.message === "string" && anyE.message.toLowerCase().includes("insufficient funds"))
    );
  }
  return false;
}

function isRevert(e: unknown): boolean {
  if (e && typeof e === "object") {
    const anyE = e as Record<string, unknown>;
    return (
      anyE.code === -32000 ||
      (typeof anyE.message === "string" && anyE.message.toLowerCase().includes("revert"))
    );
  }
  return false;
}

function extractRevertReason(e: unknown): string | undefined {
  if (e && typeof e === "object") {
    const anyE = e as Record<string, unknown>;
    if (typeof anyE.message === "string") return anyE.message;
  }
  return undefined;
}
