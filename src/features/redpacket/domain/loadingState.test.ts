import { describe, expect, it } from "vitest";
import { packetLoadingMode } from "./loadingState";

describe("packetLoadingMode", () => {
  it("blocks the page for an initial fetch without packet data", () => {
    expect(packetLoadingMode(false, "initial")).toEqual({
      blocking: true,
      refreshing: false,
    });
  });

  it("keeps existing packet data visible during polling", () => {
    expect(packetLoadingMode(true, "poll")).toEqual({
      blocking: false,
      refreshing: false,
    });
  });

  it("keeps data visible and marks a manual refresh", () => {
    expect(packetLoadingMode(true, "manual")).toEqual({
      blocking: false,
      refreshing: true,
    });
  });
});
