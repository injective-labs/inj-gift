import { randomBytes } from "node:crypto";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const SHARE_CODE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{8}$/;

export function createShareCode(
  bytes: (size: number) => Uint8Array = randomBytes,
): string {
  return Array.from(bytes(8), (value) =>
    BASE58_ALPHABET[value % BASE58_ALPHABET.length],
  ).join("");
}

export function isShareCode(value: string): boolean {
  return SHARE_CODE_PATTERN.test(value);
}
