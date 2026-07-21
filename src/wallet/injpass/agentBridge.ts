import { ethers } from "ethers";
import { syncCreatedPacket } from "@/client/gift/packetSync";
import { rememberPacketPasscode } from "@/client/gift/passcodeStore";
import type { GiftAdapter } from "@/domain/giftAdapter";
import { claimPacketReference, waitForClaimReceipt } from "@/features/claim/gaslessClaim";
import { resolvePacketReference } from "@/features/my-packets/client";
import { formatShareText } from "@/features/share/shareText";
import type { InjPassHostSession } from "@/wallet/injpass/hostProvider";

export interface InjGiftAgentCommand {
  appId: string;
  action: string;
  params?: {
    amount?: string;
    count?: number;
    password?: string;
    durationSec?: number;
    mode?: "random" | "equal";
    packetReference?: string;
  };
}

export interface InjGiftAgentResult {
  ok: boolean;
  key: string;
  data?: Record<string, unknown>;
  message?: string;
}

interface AgentDependencies {
  adapter: GiftAdapter;
  session: InjPassHostSession | null;
  resolveReference?: typeof resolvePacketReference;
  claimReference?: typeof claimPacketReference;
  syncCreated?: typeof syncCreatedPacket;
  shareOrigin?: string;
}

function transactionSession(session: InjPassHostSession | null): boolean {
  return Boolean(session?.authenticated && session.address);
}

/**
 * Hard ceiling for a single agent command, kept comfortably under the host's
 * 180s wait. A create/claim can otherwise stall forever on an on-chain
 * receipt poll inside a headless agent iframe, leaving the host to spin until
 * its own timeout with a useless "did not respond" message. When we hit this,
 * we post an honest terminal result telling the user to verify — the on-chain
 * tx may already have gone through.
 */
const AGENT_COMMAND_TIMEOUT_MS = 60_000;

class AgentCommandTimeoutError extends Error {
  constructor() {
    super("INJ Gift agent command timed out");
    this.name = "AgentCommandTimeoutError";
  }
}

function withAgentTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AgentCommandTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function executeInjGiftAgentCommand(
  command: InjGiftAgentCommand,
  dependencies: AgentDependencies,
): Promise<InjGiftAgentResult> {
  if (command.appId !== "inj-gift") return { ok: false, key: "unsupported_app" };
  const params = command.params || {};

  try {
    if (command.action === "query") {
      if (!params.packetReference) return { ok: false, key: "missing_packet_id" };
      const resolved = await (dependencies.resolveReference ?? resolvePacketReference)(
        params.packetReference,
      );
      const packet = await dependencies.adapter.getPacket(
        resolved.packetId,
        resolved.contractAddress,
      );
      return {
        ok: true,
        key: "inj_gift_packet",
        data: { packet, packetId: resolved.packetId, shareCode: resolved.shareCode },
      };
    }

    if (command.action === "create") {
      if (!transactionSession(dependencies.session)) return { ok: false, key: "login_required" };
      const amount = params.amount?.trim();
      if (!amount || Number(amount) <= 0) return { ok: false, key: "missing_amount" };
      const passcode = params.password?.trim();
      if (!passcode) {
        return {
          ok: false,
          key: "missing_password",
          message: "红包必须设置领取口令,请先提供口令再创建。/ A gift needs a claim passcode — please provide one first.",
        };
      }
      const count = Math.max(1, Math.trunc(params.count || 1));
      await dependencies.adapter.connect();
      const result = await dependencies.adapter.createPacket({
        token: ethers.ZeroAddress,
        amount: ethers.parseEther(amount).toString(),
        count,
        password: passcode,
        durationSec: Math.max(60, Math.trunc(params.durationSec || 86_400)),
        mode: params.mode === "equal" ? "equal" : "random",
      });

      // Broadcast succeeded but the receipt didn't confirm in time, so we can't
      // derive the packet id / share link yet. Hand back the passcode + tx hash
      // and point the user at the packet page rather than returning a broken link.
      if (!result.packetId) {
        return {
          ok: true,
          key: "inj_gift_submitted",
          message: `红包交易已提交,但未能及时确认,暂时拿不到分享链接。请稍后在「我的红包」页查看。\n\n- 领取口令：\`${passcode}\`\n- 交易：\`${result.hash}\``,
          data: { transactionHash: result.hash, password: passcode, amount, count },
        };
      }

      const synced = await (dependencies.syncCreated ?? syncCreatedPacket)({
        packetId: result.packetId,
        txHash: result.hash,
      });
      const shareReference = synced?.shareCode ?? result.packetId;
      rememberPacketPasscode({
        packetId: result.packetId,
        shareCode: synced?.shareCode,
        passcode,
      });
      const shareOrigin = dependencies.shareOrigin
        ?? (typeof window === "undefined" ? "" : window.location.origin);
      return {
        ok: true,
        key: "inj_gift_created",
        data: {
          transactionHash: result.hash,
          packetId: result.packetId,
          shareCode: synced?.shareCode,
          shareUrl: shareReference
            ? formatShareText({
                url: `${shareOrigin}/claim/${shareReference}`,
                passcode,
              })
            : undefined,
          password: passcode,
          amount,
          count,
          mode: params.mode === "equal" ? "equal" : "random",
        },
      };
    }

    if (command.action === "claim") {
      if (!transactionSession(dependencies.session)) return { ok: false, key: "login_required" };
      if (!params.packetReference) return { ok: false, key: "missing_packet_id" };
      if (!params.password?.trim()) return { ok: false, key: "missing_password" };
      const result = await (dependencies.claimReference ?? claimPacketReference)({
        reference: params.packetReference,
        password: params.password.trim(),
        adapter: dependencies.adapter,
        waitForReceipt: waitForClaimReceipt,
      });
      return {
        ok: true,
        key: "inj_gift_claimed",
        data: {
          transactionHash: result.hash,
          packetId: result.packetId,
          claimedAmount: result.claimAmount,
        },
      };
    }

    return { ok: false, key: "unsupported_action" };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
    if (code === 4001 || code === "USER_REJECTED") return { ok: false, key: "user_rejected" };
    return {
      ok: false,
      key: "transaction_failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

interface MessageHandlerDependencies {
  parent: WindowProxy;
  origin: string;
  adapter: GiftAdapter;
  getSession: () => InjPassHostSession | null;
  post: (payload: Record<string, unknown>) => void;
  resolveReference?: typeof resolvePacketReference;
  claimReference?: typeof claimPacketReference;
}

export function createInjGiftAgentMessageHandler(dependencies: MessageHandlerDependencies) {
  return async (event: MessageEvent): Promise<void> => {
    if (event.source !== dependencies.parent || event.origin !== dependencies.origin) return;
    const payload = event.data as Record<string, unknown> | null;
    if (
      !payload
      || payload.channel !== "injpass-miniapp-v1"
      || payload.type !== "agent-command"
      || typeof payload.id !== "string"
    ) return;
    const command = payload.command as InjGiftAgentCommand | undefined;
    if (!command || command.appId !== "inj-gift") return;

    console.info("[inj-gift agent] command received", { id: payload.id, action: command.action });

    let result: InjGiftAgentResult;
    try {
      result = await withAgentTimeout(
        executeInjGiftAgentCommand(command, {
          adapter: dependencies.adapter,
          session: dependencies.getSession(),
          resolveReference: dependencies.resolveReference,
          claimReference: dependencies.claimReference,
        }),
        AGENT_COMMAND_TIMEOUT_MS,
      );
    } catch (error) {
      // executeInjGiftAgentCommand never rejects on its own (it catches and
      // returns), so a rejection here means our own timeout fired while an
      // await inside stalled — most likely an on-chain receipt poll.
      const timedOut = error instanceof AgentCommandTimeoutError;
      result = {
        ok: false,
        key: timedOut ? "timeout" : "transaction_failed",
        message: timedOut
          ? "处理超时:交易可能已提交,请在「我的红包」页或钱包交易记录中确认。/ Timed out — the transaction may still have gone through; please verify on the packet page."
          : error instanceof Error ? error.message : String(error),
      };
    }

    console.info("[inj-gift agent] posting result", { id: payload.id, ok: result.ok, key: result.key });
    dependencies.post({
      channel: "injpass-miniapp-v1",
      type: "agent-command-result",
      id: payload.id,
      result,
    });
  };
}
