import { appError, isAppError } from "./errors";
import type { AppError } from "./errors";

export const normalizeError = (e: unknown): AppError => {
  if (isAppError(e)) {
    const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
    if (msg.includes("already-claimed")) {
      return appError("INVALID_INPUT", "该地址已领取过这个红包", { cause: e });
    }
    if (msg.includes("packet-inactive")) {
      return appError("INVALID_INPUT", "红包已结束或不可领取", { cause: e });
    }
    if (msg.includes("bad-password")) {
      return appError("INVALID_INPUT", "口令错误", { cause: e });
    }
    if (msg.includes("packet-expired")) {
      return appError("INVALID_INPUT", "红包已过期", { cause: e });
    }
    if (msg.includes("packet-not-found")) {
      return appError("NOT_FOUND", "红包不存在", { cause: e });
    }
    return e;
  }

  // Common EIP-1193 / ethers style user rejection
  if (e && typeof e === "object") {
    const anyE = e as Record<string, unknown>;
    const code = anyE.code;
    const msg = typeof anyE.message === "string" ? anyE.message : undefined;

    if (code === 4001 || (msg && msg.toLowerCase().includes("user rejected"))) {
      return appError("USER_REJECTED", "User rejected the request", { cause: e });
    }

    if (msg && msg.toLowerCase().includes("insufficient funds")) {
      return appError("INSUFFICIENT_FUNDS", "Insufficient funds", { cause: e });
    }

    if (msg && msg.toLowerCase().includes("wrong network")) {
      return appError("WRONG_NETWORK", msg, { cause: e });
    }

    if (msg && msg.toLowerCase().includes("already-claimed")) {
      return appError("INVALID_INPUT", "该地址已领取过这个红包", { cause: e });
    }

    if (msg && msg.toLowerCase().includes("provider not found")) {
      return appError(
        "NOT_SUPPORTED",
        "Wallet provider not found. Please install or enable the wallet extension.",
        { cause: e },
      );
    }

    if (msg && msg.toLowerCase().includes("missing revert data")) {
      return appError("REVERT", "交易被拒绝或条件不满足", { cause: e });
    }

    if (msg && msg.toLowerCase().includes("call_exception")) {
      return appError("REVERT", "交易失败（合约拒绝执行）", { cause: e });
    }

    if (msg && msg.toLowerCase().includes("revert")) {
      return appError("REVERT", msg, { cause: e });
    }

    if (msg && (msg.toLowerCase().includes("rpc") || msg.toLowerCase().includes("json-rpc"))) {
      return appError("RPC_ERROR", msg, { cause: e });
    }
  }

  if (e instanceof Error) {
    return appError("UNKNOWN", e.message || "Unknown error", { cause: e });
  }

  return appError("UNKNOWN", "Unknown error", { cause: e });
};


