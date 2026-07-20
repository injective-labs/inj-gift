// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  getPacketPasscode,
  rememberPacketPasscode,
} from "./passcodeStore";

describe("packet passcode storage", () => {
  beforeEach(() => localStorage.clear());

  it("restores a new packet passcode by packet ID or share code", () => {
    rememberPacketPasscode({
      packetId: `0x${"11".repeat(32)}`,
      shareCode: "XgHCPbq9",
      passcode: "hihi",
    });

    expect(getPacketPasscode({ packetId: `0x${"11".repeat(32)}` })).toBe("hihi");
    expect(getPacketPasscode({ shareCode: "XgHCPbq9" })).toBe("hihi");
  });

  it("does not invent a passcode for an old packet", () => {
    expect(getPacketPasscode({ shareCode: "3kP9xQ7m" })).toBeNull();
  });
});
