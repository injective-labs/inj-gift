# Gasless Claim Amount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return the exact `RedPacketClaimed.amount` from browser-side gasless claims.

**Architecture:** Add a focused receipt parser and an injectable receipt waiter to `gaslessClaim.ts`. After relay submission, wait on the configured public RPC, validate receipt status, strictly match the claim event, and return the existing optional `claimAmount` and `receipt` fields.

**Tech Stack:** TypeScript, ethers 6, Vitest, Next.js 16

## Global Constraints

- Do not change the contract or relay response schema.
- Match contract address, packet ID, and claimer before accepting an amount.
- Preserve hash-only success when the receipt waiter returns `null`.
- Do not hide RPC failures or confirmed transaction reverts.
- Do not commit unless explicitly requested.

---

### Task 1: Add Receipt Regression Tests

**Files:**
- Modify: `src/features/claim/gaslessClaim.test.ts`

**Interfaces:**
- Consumes: `waitForReceipt(transactionHash, chainId)`
- Produces: gasless result `{ hash, receipt?, claimAmount? }`

- [ ] Add a test with a real ABI-encoded `RedPacketClaimed` log and assert `claimAmount`.
- [ ] Add tests for `null` receipt and confirmed reverted receipt.
- [ ] Run `pnpm exec vitest run src/features/claim/gaslessClaim.test.ts` and verify the amount test fails because no receipt dependency exists.

### Task 2: Read and Parse the Receipt

**Files:**
- Modify: `src/features/claim/gaslessClaim.ts`

**Interfaces:**
- Consumes: relay transaction hash, chain ID, contract address, packet ID, and claimer
- Produces: `{ hash, receipt, claimAmount }` when a matching event exists

- [ ] Add typed receipt/log shapes and `waitForReceipt` to `Dependencies`.
- [ ] Implement the default waiter with `JsonRpcProvider.waitForTransaction(hash, 1, 120_000)`.
- [ ] Parse logs with the existing `InjGift` ABI and strictly match contract, packet, and claimer.
- [ ] Return hash-only on `null`, throw on status `0`, and otherwise return receipt plus optional amount.
- [ ] Run the focused test file and verify all tests pass.

### Task 3: Verify the Application

**Files:**
- Verify: `src/features/claim/gaslessClaim.ts`
- Verify: `src/features/claim/gaslessClaim.test.ts`

**Interfaces:**
- Consumes: completed implementation
- Produces: deployable frontend behavior

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run `git diff --check` and inspect the final diff.
