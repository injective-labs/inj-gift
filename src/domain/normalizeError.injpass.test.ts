import { describe, expect, it } from "vitest";

import { normalizeError } from "./normalizeError";

describe("normalizeError INJ Pass connection states", () => {
  it("treats an INJ Pass cancellation as a user rejection", () => {
    expect(normalizeError(Object.assign(new Error("Authentication window was closed"), {
      code: "USER_CANCELLED",
    }))).toMatchObject({
      code: "USER_REJECTED",
      messageKey: "userRejected",
    });
  });

  it.each([
    ["POPUP_BLOCKED", "popupBlocked"],
    ["CONNECTION_TIMEOUT", "connectionTimeout"],
  ])("keeps %s actionable", (code, messageKey) => {
    expect(normalizeError(Object.assign(new Error(code), { code }))).toMatchObject({
      code: "NOT_SUPPORTED",
      messageKey,
    });
  });
});
