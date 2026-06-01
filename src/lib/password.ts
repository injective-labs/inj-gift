import { sha256 } from "@cosmjs/crypto";
import { toBase64 } from "@cosmjs/encoding";

export const buildPasswordHashBase64 = (password: string): string => {
  return toBase64(sha256(new TextEncoder().encode(password)));
};


