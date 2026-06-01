import { describe, it, expect } from "vitest";
import { normalizeError } from "./normalizeError";
import { appError } from "./errors";

describe("normalizeError", () => {
  it("passes through existing AppError unchanged", () => {
    const e = appError("USER_REJECTED", "User rejected");
    expect(normalizeError(e)).toBe(e);
  });

  it("recognizes EIP-1193 user rejection (code 4001)", () => {
    const e = { code: 4001 };
    const normalized = normalizeError(e);
    expect(normalized.code).toBe("USER_REJECTED");
    expect(normalized.message).toBe("User rejected the request");
  });

  it("recognizes user rejection by message", () => {
    const e = { message: "User rejected the request." };
    const normalized = normalizeError(e);
    expect(normalized.code).toBe("USER_REJECTED");
  });

  it("recognizes insufficient funds", () => {
    const e = { message: "insufficient funds for gas" };
    const normalized = normalizeError(e);
    expect(normalized.code).toBe("INSUFFICIENT_FUNDS");
  });

  it("recognizes wrong network", () => {
    const e = { message: "Wrong network" };
    const normalized = normalizeError(e);
    expect(normalized.code).toBe("WRONG_NETWORK");
  });

  it("recognizes revert", () => {
    const e = { message: "execution reverted" };
    const normalized = normalizeError(e);
    expect(normalized.code).toBe("REVERT");
  });

  it("recognizes RPC errors", () => {
    const e = { message: "JSON-RPC error" };
    const normalized = normalizeError(e);
    expect(normalized.code).toBe("RPC_ERROR");
  });

  it("falls back to UNKNOWN for generic Error", () => {
    const e = new Error("Something went wrong");
    const normalized = normalizeError(e);
    expect(normalized.code).toBe("UNKNOWN");
    expect(normalized.message).toBe("Something went wrong");
  });

  it("falls back to UNKNOWN for unknown shape", () => {
    const e = "string error";
    const normalized = normalizeError(e);
    expect(normalized.code).toBe("UNKNOWN");
    expect(normalized.message).toBe("Unknown error");
  });
});


