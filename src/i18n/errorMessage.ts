import { isAppError } from "@/domain/errors";
import type { Dict } from "./messages";

/**
 * Resolve a thrown value into a localized, user-facing message.
 *
 * AppErrors created by `normalizeError` may carry a `messageKey` pointing at a
 * stable entry in `t.errors`; when present we use the localized text. Otherwise
 * we fall back to the error's own message (often a raw chain/RPC string that has
 * no sensible translation), and finally to a generic localized message.
 */
export function errorMessage(e: unknown, t: Dict): string {
  if (isAppError(e)) {
    const key = e.messageKey;
    if (key && key in t.errors) {
      return (t.errors as Record<string, string>)[key];
    }
    if (e.message) return e.message;
    return t.errors.unknown;
  }
  if (e instanceof Error && e.message) return e.message;
  return t.errors.unknown;
}
