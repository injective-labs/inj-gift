/**
 * Validates if a string is a valid EVM bytes32 hex string (0x followed by 64 hex chars)
 */
export const isBytes32Hex = (id: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(id);
};

/**
 * Validates an 8-character base58 share code (the short id embedded in share links).
 * Mirrors the server-side pattern in src/server/gift/shareCode.ts.
 */
export const isShareCode = (value: string): boolean => {
  return /^[1-9A-HJ-NP-Za-km-z]{8}$/.test(value);
};

/**
 * Normalizes a user-pasted packet reference: a full share URL collapses to its
 * last path segment (the share code / packet id), anything else is returned trimmed.
 * The URL's hash (e.g. #passcode=...) is intentionally dropped here — callers that
 * want to preserve it should read it separately.
 */
export const extractPacketReference = (value: string): string => {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.pathname.split("/").filter(Boolean).at(-1) ?? trimmed;
  } catch {
    return trimmed;
  }
};

/**
 * Shortens an address or ID for display
 */
export const shortenId = (id: string, chars = 6): string => {
  if (id.length <= chars * 2 + 2) return id;
  return `${id.slice(0, chars + 2)}...${id.slice(-chars)}`;
};


