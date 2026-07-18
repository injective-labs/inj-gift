# Network-Neutral Balance Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize insufficient-INJ errors without obsolete Testnet wording.

**Architecture:** Preserve the existing `errors.insufficientFunds` key and language-selection path; change only the four locale values and lock them with a dictionary regression test.

**Tech Stack:** TypeScript, Vitest

## Global Constraints

- Modify `inj-gift/main` only.
- Do not change wallet, provider, balance, or transaction behavior.
- Support Chinese, English, Japanese, and Korean through the existing dictionaries.

---

### Task 1: Update localized insufficient-balance copy

**Files:**
- Create: `src/i18n/messages.test.ts`
- Modify: `src/i18n/messages.ts`

**Interfaces:**
- Consumes: `getMessages(locale)` from `src/i18n/messages.ts`.
- Produces: network-neutral `errors.insufficientFunds` values for `zh`, `en`, `ja`, and `ko`.

- [ ] Write a failing test asserting that every supported locale contains `INJ` and does not match `/测试网|Testnet|テストネット|테스트넷/i`.
- [ ] Run `npm test -- src/i18n/messages.test.ts` and verify RED.
- [ ] Replace the four obsolete messages with approved network-neutral translations.
- [ ] Run focused test, full tests, typecheck, scoped lint, and build; all must exit `0`.
- [ ] Commit `src/i18n/messages.ts` and `src/i18n/messages.test.ts` with `fix: remove obsolete testnet balance copy`.
- [ ] Push `main` to `origin`.
