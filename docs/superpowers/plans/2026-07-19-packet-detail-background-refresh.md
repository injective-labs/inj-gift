# Packet Detail Background Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep packet details visible during polling and eliminate the loading-effect loop.

**Architecture:** Add a pure loading-mode helper, then use refs in the page to guard overlapping requests and retain current data during background refresh. Keep the five-second interval stable by removing loading state from the fetch callback dependencies.

**Tech Stack:** React 19, TypeScript, Vitest

## Global Constraints

- Modify `inj-gift/main` only.
- Preserve five-second packet polling.
- Show blocking loading only before the first successful packet response.
- Do not change contract or wallet behavior.

---

### Task 1: Stabilize packet refresh UI

**Files:**
- Create: `src/features/redpacket/domain/loadingState.ts`
- Create: `src/features/redpacket/domain/loadingState.test.ts`
- Modify: `src/app/packet/[id]/page.tsx`

**Interfaces:**
- Produces: `packetLoadingMode(hasData: boolean, source: 'initial' | 'poll' | 'manual'): { blocking: boolean; refreshing: boolean }`.

- [ ] Write failing tests proving initial fetch without data blocks, polling with data is silent, and manual refresh with data only marks refreshing.
- [ ] Run the focused test and verify RED.
- [ ] Implement the minimal helper.
- [ ] Update the page to use stable callbacks, `inFlightRef`, request sequence, initial loading, and refresh-icon state.
- [ ] Run focused/full tests, typecheck, scoped lint, and build.
- [ ] Commit with `fix: stabilize packet detail background refresh` and push `main`.
