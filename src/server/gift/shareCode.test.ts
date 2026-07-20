import { describe, expect, it } from "vitest";
import { createShareCode, isShareCode } from "./shareCode";

describe("gift share codes", () => {
  it("creates an eight-character Base58 code", () => {
    const code = createShareCode(() =>
      Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]),
    );

    expect(code).toBe("12345678");
    expect(isShareCode(code)).toBe(true);
  });

  it.each(["short", "00000000", "O1234567", "I1234567", "l1234567"])(
    "rejects invalid code %s",
    (code) => {
      expect(isShareCode(code)).toBe(false);
    },
  );
});
