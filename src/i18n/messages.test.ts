import { describe, expect, it } from "vitest";
import { messages } from "./messages";

describe("localized insufficient balance copy", () => {
  it("is network-neutral in every supported locale", () => {
    for (const dictionary of Object.values(messages)) {
      const copy = dictionary.errors.insufficientFunds;
      expect(copy).toContain("INJ");
      expect(copy).not.toMatch(/测试网|Testnet|テストネット|테스트넷/i);
    }
  });
});
