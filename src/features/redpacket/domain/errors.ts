export interface RedPacketError {
  code: string;
  message: string;
  raw: unknown;
}

/** Friendly message mapping */
const FRIENDLY_MAP: Record<string, string> = {
  "packet-expired": "红包已过期",
  "packet-inactive": "红包已失效",
  "already-claimed": "你已领取过该红包",
  "bad-password": "口令错误，请检查后重试",
  "all-claimed": "红包已被领完",
  "packet-not-found": "未找到该红包",
  "amount<min": "金额低于最小限制",
  "insufficient-funds": "余额不足，无法发起交易",
  "sequence-mismatch": "账户序号不匹配，请稍后重试",
  "out-of-gas": "Gas 不足，请提高 Gas 或稍后重试",
  "signature-failed": "签名失败，请重新连接钱包",
  "wallet-not-connected": "请先连接钱包",
  "no-signer": "未获取到签名器，请重新连接钱包",
  "unauthorized": "未授权操作，请检查钱包权限",
};

/**
 * Normalise error from CosmJS/Injective SDK or contract revert.
 */
export const mapRedPacketError = (err: unknown): RedPacketError => {
  let code = "unknown";
  const capture = (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes("insufficient funds")) return "insufficient-funds";
    if (lower.includes("account sequence mismatch")) return "sequence-mismatch";
    if (lower.includes("out of gas")) return "out-of-gas";
    if (lower.includes("signature verification failed")) return "signature-failed";
    if (lower.includes("wallet not connected")) return "wallet-not-connected";
    if (lower.includes("no signer")) return "no-signer";
    if (lower.includes("unauthorized")) return "unauthorized";
    return undefined;
  };
  // Try safe extraction first
  if (err && typeof err === "object") {
    // CosmJS: DeliverTxResponse with rawLog
    if ("rawLog" in err && typeof err.rawLog === "string") {
      const match = err.rawLog.match(/packet-[a-z-]+|already-claimed|bad-password|amount<min/);
      if (match) code = match[0];
      if (code === "unknown") {
        const extra = capture(err.rawLog);
        if (extra) code = extra;
      }
    }
    // Generic message field
    if ("message" in err && typeof err.message === "string") {
      const match = err.message.match(/packet-[a-z-]+|already-claimed|bad-password|amount<min/);
      if (match) code = match[0];
      if (code === "unknown") {
        const extra = capture(err.message);
        if (extra) code = extra;
      }
    }
  }
  // Fallback: limited stringify with try/catch to avoid circular refs
  if (code === "unknown") {
    try {
      const s = JSON.stringify(err);
      const match = s.match(/packet-[a-z-]+|already-claimed|bad-password|amount<min/);
      if (match) code = match[0];
      if (code === "unknown") {
        const extra = capture(s);
        if (extra) code = extra;
      }
    } catch {
      // ignore
    }
  }
  let message = FRIENDLY_MAP[code] || "交易失败，请稍后重试";
  if (code === "unknown" && err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    const trimmed = err.message.split("\n")[0].slice(0, 140);
    if (trimmed) message = trimmed;
  }
  return { code, message, raw: err };
};

/* ---------------- Example ---------------- */
// try {
//   await claimPacket(...);
// } catch (e) {
//   const mapped = mapRedPacketError(e);
//   console.log(mapped.message);
// }





