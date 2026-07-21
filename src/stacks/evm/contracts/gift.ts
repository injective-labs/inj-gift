import { ethers, Contract, BrowserProvider, Signer, type Provider } from "ethers";
import { appError } from "@/domain/errors";
import type { DistributionMode, GiftPacket } from "@/domain/types";
import { injGiftAddress } from "../config";
import abiRaw from "@/lib/abi/InjGift.json";

const abi = abiRaw;

type TxLike = { hash: string; wait?: () => Promise<{ logs?: Array<unknown> }> };

export class InjGiftContractWrapper {
  private contract: Contract;

  constructor(
    private signerOrProvider: Signer | Provider,
    contractAddress: string | undefined = injGiftAddress,
  ) {
    if (!contractAddress) {
      throw appError(
        "INVALID_INPUT",
        "EVM contract address not configured. Set NEXT_PUBLIC_EVM_CONTRACT_ADDRESS",
      );
    }
    this.contract = new Contract(contractAddress, abi, signerOrProvider);
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
      if (params.token === ethers.ZeroAddress) {
        await this.assertNativeBalance(BigInt(params.amount));
      }
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

      // Wait for the tx to be mined so we can extract packetId from receipt
      // logs (needed for the share link/code). Bounded by a timeout: on a
      // healthy chain the receipt lands in a couple of seconds, but a stalled
      // receipt poll must never hang the caller forever (e.g. inside a headless
      // agent iframe). On timeout we return the hash with no packetId and let
      // the caller surface a "submitted, verify later" state.
      let packetId: string | undefined;
      let receipt: unknown;
      if (tx.wait) {
        receipt = await waitWithTimeout(tx.wait(), 30_000);
        if (receipt) {
          packetId = this.extractPacketId(receipt as { logs?: Array<unknown> });
        } else {
          console.warn('[inj-gift] createRedPacket receipt not observed in time; returning hash only');
        }
      }
      return { hash: tx.hash, receipt, packetId };
    } catch (e: unknown) {
      if (isUserRejected(e)) throw appError("USER_REJECTED", "User rejected transaction");
      if (isInsufficientFunds(e)) {
        throw appError("INSUFFICIENT_FUNDS", "Insufficient funds for gas + value", {
          cause: e,
          messageKey: "insufficientFunds",
        });
      }
      if (isRevert(e)) {
        const reason = extractRevertReason(e);
        throw appError("REVERT", reason || "Contract reverted", { cause: e });
      }
      throw appError("RPC_ERROR", "Failed to create packet", { cause: e });
    }
  }

  private async assertNativeBalance(packetAmount: bigint): Promise<void> {
    const signer = this.signerOrProvider as Signer;
    const provider = signer.provider
      || (this.signerOrProvider instanceof BrowserProvider ? this.signerOrProvider : null);
    if (!provider || typeof signer.getAddress !== "function") return;

    const sender = await signer.getAddress();
    const balance = await provider.getBalance(sender);
    if (balance <= packetAmount) {
      throw appError(
        "INSUFFICIENT_FUNDS",
        "Insufficient INJ balance for the packet amount and gas",
        {
          messageKey: "insufficientFunds",
          data: {
            balance: balance.toString(),
            packetAmount: packetAmount.toString(),
          },
        },
      );
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
      if (isInsufficientFunds(e)) {
        throw appError("INSUFFICIENT_FUNDS", "Insufficient funds for gas", {
          cause: e,
          messageKey: "insufficientFunds",
        });
      }
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
      if (isInsufficientFunds(e)) {
        throw appError("INSUFFICIENT_FUNDS", "Insufficient funds for gas", {
          cause: e,
          messageKey: "insufficientFunds",
        });
      }
      if (isRevert(e)) {
        const reason = extractRevertReason(e);
        throw appError("REVERT", reason || "Contract reverted", { cause: e });
      }
      throw appError("RPC_ERROR", "Failed to refund packet", { cause: e });
    }
  }
}

/**
 * Resolve with the awaited value, or `undefined` if it doesn't settle within
 * `timeoutMs`. Never rejects on timeout; the underlying promise keeps running
 * (its result is simply ignored), so a stalled receipt poll can't hang callers.
 */
async function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
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
    const details = collectErrorText(e).toLowerCase();
    return (
      anyE.code === "INSUFFICIENT_FUNDS" ||
      details.includes("insufficient funds") ||
      details.includes("insufficient balance") ||
      details.includes("funds for gas")
    );
  }
  return false;
}

function isRevert(e: unknown): boolean {
  if (e && typeof e === "object") {
    const anyE = e as Record<string, unknown>;
    return (
      anyE.code === -32000 ||
      collectErrorText(e).toLowerCase().includes("revert")
    );
  }
  return false;
}

function extractRevertReason(e: unknown): string | undefined {
  if (e && typeof e === "object") {
    const anyE = e as Record<string, unknown>;
    if (typeof anyE.reason === "string") return anyE.reason;
    if (typeof anyE.shortMessage === "string") return anyE.shortMessage;
    if (typeof anyE.message === "string") return anyE.message;
  }
  return undefined;
}

function collectErrorText(value: unknown, depth = 0, seen = new Set<unknown>()): string {
  if (depth > 4 || value === null || value === undefined || seen.has(value)) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return "";
  seen.add(value);
  const record = value as Record<string, unknown>;
  return [
    record.message,
    record.shortMessage,
    record.reason,
    record.error,
    record.info,
    record.cause,
    record.data,
  ].map((item) => collectErrorText(item, depth + 1, seen)).filter(Boolean).join(" ");
}
