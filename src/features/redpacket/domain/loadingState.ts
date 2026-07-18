export type PacketFetchSource = "initial" | "poll" | "manual";

export function packetLoadingMode(
  hasData: boolean,
  source: PacketFetchSource,
): { blocking: boolean; refreshing: boolean } {
  return {
    blocking: !hasData,
    refreshing: hasData && source === "manual",
  };
}
