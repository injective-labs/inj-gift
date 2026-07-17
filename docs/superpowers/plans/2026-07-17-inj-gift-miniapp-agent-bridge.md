# INJ Gift Mini-dApp and Agent Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make embedded INJ Gift support manual create/claim through the INJ Pass host wallet and make AI Chat create/claim/query through the same INJ Gift execution layer.

**Architecture:** INJ Gift owns contract preparation and result parsing. Its visible UI and hidden agent bridge both use the hosted EIP-1193 provider; INJ Pass owns session, authorization, signing, command routing, and localized presentation.

**Tech Stack:** Next.js 16, React 19, TypeScript, wagmi, ethers 6, viem, Vitest, INJ Pass `postMessage` protocol.

## Global Constraints

- Modify `inj-gift/main` and `inj-pass-frontend/dev` only.
- Do not push a remote `main` branch.
- Never send a private key across the mini-dApp boundary.
- Preserve standalone INJ Gift connection behavior.
- Use test-driven development for each production change.

---

### Task 1: Harden the hosted wallet lifecycle

**Files:**
- Modify: `inj-gift/src/wallet/injpass/hostProvider.ts`
- Test: `inj-gift/src/wallet/injpass/hostProvider.test.ts`
- Modify: `inj-gift/src/wallet/injpass/provider.ts`

**Interfaces:**
- Produces: `getInjpassHostProvider()`, `subscribeToInjpassHostSession()`, and an EIP-1193 provider that emits account/chain changes and rejects pending requests on logout.
- Consumes: `session`, `rpc-response`, and `navigation-command` messages from `injpass-miniapp-v1`.

- [ ] Write tests proving spoofed origins are ignored, correlated errors retain code/message, logout emits an empty account list, and pending requests are cleaned up.
- [ ] Run `pnpm vitest run src/wallet/injpass/hostProvider.test.ts`; expect the new lifecycle case to fail.
- [ ] Add explicit session validation and pending-request cleanup to `InjPassHostProvider`.
- [ ] Update `connectInjpass()` so hosted sessions become the active provider without opening standalone `/auth`.
- [ ] Run the focused test, `pnpm typecheck`, and commit with `fix: stabilize INJ Pass hosted wallet lifecycle`.

### Task 2: Create one red-packet execution service and wire manual UI

**Files:**
- Create: `inj-gift/src/features/redpacket/services/redPacketExecutor.ts`
- Test: `inj-gift/src/features/redpacket/services/redPacketExecutor.test.ts`
- Modify: `inj-gift/src/features/redpacket/hooks/useCreateRedPacket.ts`
- Modify: `inj-gift/src/features/redpacket/hooks/useClaimRedPacket.ts`
- Modify: `inj-gift/src/features/redpacket/hooks/useRedPacketStatus.ts`

**Interfaces:**
- Produces: `executeCreateRedPacket(input, wallet)`, `executeClaimRedPacket(input, wallet)`, and `queryRedPacket(packetId)` with structured results.
- Consumes: the existing EVM contract adapter and EIP-1193-backed signer.

- [ ] Write service tests using mocked contract calls for create, claim, query, rejection, and invalid inputs.
- [ ] Run the focused test and confirm failure because the service does not exist.
- [ ] Move transaction construction, receipt parsing, and error normalization into the service without changing contract semantics.
- [ ] Make existing hooks delegate to the service so visible manual create/claim uses the host wallet in embedded mode.
- [ ] Run red-packet tests, typecheck, and commit with `refactor: share INJ Gift red packet execution`.

### Task 3: Add the INJ Gift agent-command bridge

**Files:**
- Create: `inj-gift/src/wallet/injpass/agentBridge.ts`
- Test: `inj-gift/src/wallet/injpass/agentBridge.test.ts`
- Create: `inj-gift/src/components/InjPassAgentBridge.tsx`
- Modify: `inj-gift/src/app/layout.tsx`

**Interfaces:**
- Consumes command shape `{ appId: 'inj-gift', action: 'create' | 'claim' | 'query', params: {...} }`.
- Produces `agent-command-result` with `{ ok, key, data, message? }` correlated by command ID.

- [ ] Write failing tests for create, claim, query, login-required, malformed input, and origin/source rejection.
- [ ] Run `pnpm vitest run src/wallet/injpass/agentBridge.test.ts`; expect missing bridge failures.
- [ ] Implement a pure command dispatcher that calls the shared executor and returns stable result keys.
- [ ] Mount a client component that listens only to the configured parent window/origin and posts correlated results.
- [ ] Run focused tests, full INJ Gift tests, typecheck, lint, and build; commit with `feat: execute INJ Gift agent commands`.

### Task 4: Route frontend AI Chat through the INJ Gift mini-dApp

**Files:**
- Modify: `inj-pass-frontend/src/services/mini-app-commands.ts`
- Modify: `inj-pass-frontend/scripts/test-mini-app-commands.ts`
- Modify: `inj-pass-frontend/app/components/InjPassChatShell.tsx`
- Modify or remove direct execution from: `inj-pass-frontend/src/services/inj-gift.ts`

**Interfaces:**
- Produces a `MiniAppAgentCommand` for INJ Gift and localized formatting for stable result keys.
- Consumes INJ Gift `agent-command-result` messages through the existing hidden mini-app runner.

- [ ] Add failing parser/result tests for create, claim, query, missing fields, successful hashes, login-required, rejection, and timeout.
- [ ] Run `npm run test-mini-app-commands`; expect INJ Gift mini-app command assertions to fail.
- [ ] Parse `@INJ Gift` into the common mini-app command type while preserving existing language rules.
- [ ] Replace `executeInjGiftCommand(...privateKey)` in `InjPassChatShell` with `runMiniAppAgentCommand()`.
- [ ] Format structured INJ Gift results for AI Chat and remove the frontend private-key transaction path.
- [ ] Run frontend unit tests, `npx tsc --noEmit`, and production build; commit with `feat: route INJ Gift AI actions through mini app`.

### Task 5: Cross-repository regression verification

**Files:**
- No production files expected.

**Interfaces:**
- Verifies both repositories against the protocol defined in the design specification.

- [ ] Confirm `inj-gift` is on `main` and `inj-pass-frontend` is on `dev`, with only intended changes.
- [ ] Run all INJ Gift tests, typecheck, lint, and build.
- [ ] Run all frontend tests, mini-app command tests, typecheck, and build.
- [ ] Verify built frontend assets reference `https://www.inj-gift.fun` and `injpass-miniapp-v1`.
- [ ] Review diffs for private-key transport, wildcard origins, unbounded pending requests, or unrelated changes.
- [ ] Record commits and deployment order without pushing remote `main`.
