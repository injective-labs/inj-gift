import { describe, expect, it } from "vitest";
import { formatShareText } from "./shareText";

describe("formatShareText", () => {
  it("includes the claim URL and passcode in Chinese", () => {
    expect(
      formatShareText({
        url: "https://gift.injpass.com/claim/3kP9xQ7m",
        passcode: "lucky",
        locale: "zh",
      }),
    ).toBe(
      "领取链接：https://gift.injpass.com/claim/3kP9xQ7m\n领取口令：lucky",
    );
  });

  it("uses share wording in English", () => {
    expect(
      formatShareText({
        url: "https://gift.injpass.com/claim/3kP9xQ7m",
        passcode: "lucky",
        locale: "en",
      }),
    ).toContain("Claim passcode: lucky");
  });
});
