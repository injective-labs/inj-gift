# INJ Gift Standalone Relayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move gas sponsorship into INJ Gift and remove INJ Gift backend/business coupling from INJ Pass.

**Architecture:** A same-origin Next.js route delegates to an INJ Gift server-only Relayer service. INJ Pass remains a generic wallet/session/signing host and Chat mini-app dispatcher.

**Tech Stack:** Next.js 16, ethers 6, PostgreSQL, NestJS, Vitest, Jest

## Global Constraints

- INJ Gift must run without `inj-pass-backend`.
- The Relayer private key must remain server-only.
- The route must not accept arbitrary calldata or targets.
- Existing short-code, legacy-contract and Chat behavior must remain functional.
- Do not commit or push.

---

### Task 1: Same-Origin Relayer

**Files:**
- Create: `src/server/gift/relayer.ts`
- Create: `src/server/gift/relayer.test.ts`
- Create: `src/app/api/gift/claims/relay/route.ts`
- Create: `src/app/api/gift/claims/relay/route.test.ts`
- Modify: `src/features/claim/gaslessClaim.ts`
- Modify: `src/features/claim/gaslessClaim.test.ts`

- [ ] Write failing service, route and same-origin client tests.
- [ ] Implement strict DTO validation and server-only transaction construction.
- [ ] Change the client endpoint to `/api/gift/claims/relay`.
- [ ] Run targeted tests and typecheck.

### Task 2: Configuration and Documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] Remove `NEXT_PUBLIC_INJPASS_API_URL`.
- [ ] Add server-only Relayer variables and deployment instructions.
- [ ] Verify no private key is referenced by client code.

### Task 3: Remove INJ Pass Backend Coupling

**Files:**
- Delete: `../inj-pass-backend/src/inj-gift/`
- Modify: `../inj-pass-backend/src/app.module.ts`
- Modify: `../inj-pass-backend/.env.example`

- [ ] Remove the module registration and environment entries.
- [ ] Search for all remaining INJ Gift backend references.
- [ ] Run backend tests and build.

### Task 4: Clean INJ Pass Frontend Boundary

**Files:**
- Modify: `../inj-pass-frontend/src/services/inj-gift.ts`
- Modify: `../inj-pass-frontend/app/components/InjPassChatShell.tsx`
- Preserve: `../inj-pass-frontend/src/services/mini-app-host.ts`

- [ ] Remove direct private-key contract execution and dead fallback handling.
- [ ] Preserve parser and hidden mini-app command dispatch.
- [ ] Verify typed-data signing remains generic host functionality.
- [ ] Run Chat tests, host tests, typecheck and build.

### Task 5: Cross-Repository Verification

- [ ] Run all INJ Gift tests, typecheck and build.
- [ ] Run INJ Pass backend tests and build.
- [ ] Run INJ Pass frontend Chat/host tests, typecheck and build.
- [ ] Inspect all diffs and confirm no commit or push occurred.

