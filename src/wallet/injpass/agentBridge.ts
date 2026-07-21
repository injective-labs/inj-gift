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
      if (!params.password?.trim()) return { ok: false, key: "missing_password" };
      const count = Math.max(1, Math.trunc(params.count || 1));
      await dependencies.adapter.connect();
      const result = await dependencies.adapter.createPacket({
        token: ethers.ZeroAddress,
        amount: ethers.parseEther(amount).toString(),
        count,
        password: params.password.trim(),
        durationSec: Math.max(60, Math.trunc(params.durationSec || 86_400)),
        mode: params.mode === "equal" ? "equal" : "random",
      });
      const synced = result.packetId
        ? await (dependencies.syncCreated ?? syncCreatedPacket)({
            packetId: result.packetId,
            txHash: result.hash,
          })
        : null;
      const shareReference = synced?.shareCode ?? result.packetId;
      if (result.packetId) {
        rememberPacketPasscode({
          packetId: result.packetId,
          shareCode: synced?.shareCode,
          passcode: params.password.trim(),
        });
      }
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
                passcode: params.password.trim(),
              })
            : undefined,
          password: params.password.trim(),
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
    const result = await executeInjGiftAgentCommand(command, {
      adapter: dependencies.adapter,
      session: dependencies.getSession(),
      resolveReference: dependencies.resolveReference,
      claimReference: dependencies.claimReference,
    });
    dependencies.post({
      channel: "injpass-miniapp-v1",
      type: "agent-command-result",
      id: payload.id,
      result,
    });
  };
}
