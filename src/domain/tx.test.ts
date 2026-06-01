import { describe, it, expect } from "vitest";
import { txIdle, txSigning, txPending, txConfirmed, txFailed } from "./tx";
import { appError } from "./errors";

describe("tx state helpers", () => {
  it("creates idle state", () => {
    const s = txIdle();
    expect(s.status).toBe("idle");
  });

  it("creates signing state", () => {
    const s = txSigning();
    expect(s.status).toBe("signing");
  });

  it("creates pending state with hash", () => {
    const s = txPending("0xabc");
    expect(s.status).toBe("pending");
    expect(s.hash).toBe("0xabc");
  });

  it("creates confirmed state with receipt", () => {
    const receipt = { ok: true };
    const s = txConfirmed("0xabc", receipt);
    expect(s.status).toBe("confirmed");
    expect(s.hash).toBe("0xabc");
    expect(s.receipt).toEqual(receipt);
  });

  it("creates failed state with error", () => {
    const err = appError("RPC_ERROR", "rpc");
    const s = txFailed(err, "0xabc");
    expect(s.status).toBe("failed");
    expect(s.hash).toBe("0xabc");
    expect(s.error).toBe(err);
  });
});


