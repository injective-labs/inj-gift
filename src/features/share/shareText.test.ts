import { describe, expect, it } from "vitest";
import { formatShareText, parseSharePasscode } from "./shareText";

describe("formatShareText", () => {
  it("returns one directly navigable URL containing the passcode", () => {
    expect(
      formatShareText({
        url: "https://gift.injpass.com/claim/3kP9xQ7m",
        passcode: "lucky gift",
      }),
    ).toBe("https://gift.injpass.com/claim/3kP9xQ7m#passcode=lucky+gift");
  });

  it("restores the passcode from a share URL fragment", () => {
    expect(parseSharePasscode("#passcode=lucky+gift")).toBe("lucky gift");
  });
});
