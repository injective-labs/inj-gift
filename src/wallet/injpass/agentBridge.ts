import { ethers } from "ethers";
import type { GiftAdapter } from "@/domain/giftAdapter";
import type { InjPassHostSession } from "@/wallet/injpass/hostProvider";

const PACKET_ID = /^0x[a-fA-F0-9]{64}$/;

export interface InjGiftAgentCommand {
  appId: string;
  action: string;
  params?: {
    amount?: string;
    count?: number;
    password?: string;
    durationSec?: number;
    mode?: "random" | "equal";
    packetId?: string;
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
      if (!params.packetId || !PACKET_ID.test(params.packetId)) return { ok: false, key: "missing_packet_id" };
      const packet = await dependencies.adapter.getPacket(params.packetId);
      return { ok: true, key: "inj_gift_packet", data: { packet } };
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
      return {
        ok: true,
        key: "inj_gift_created",
        data: {
          transactionHash: result.hash,
          packetId: result.packetId,
          password: params.password.trim(),
          amount,
          count,
          mode: params.mode === "equal" ? "equal" : "random",
        },
      };
    }

    if (command.action === "claim") {
      if (!transactionSession(dependencies.session)) return { ok: false, key: "login_required" };
      if (!params.packetId || !PACKET_ID.test(params.packetId)) return { ok: false, key: "missing_packet_id" };
      if (!params.password?.trim()) return { ok: false, key: "missing_password" };
      await dependencies.adapter.connect();
      const result = await dependencies.adapter.claimPacket({ id: params.packetId, password: params.password.trim() });
      return {
        ok: true,
        key: "inj_gift_claimed",
        data: {
          transactionHash: result.hash,
          packetId: params.packetId,
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
    });
    dependencies.post({
      channel: "injpass-miniapp-v1",
      type: "agent-command-result",
      id: payload.id,
      result,
    });
  };
}
