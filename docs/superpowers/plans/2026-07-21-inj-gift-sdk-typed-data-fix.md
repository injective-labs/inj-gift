# INJ Gift SDK Typed-Data Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore valid EIP-712 gasless claim signatures and surface safe relay rejection messages.

**Architecture:** INJ Gift continues to request `eth_signTypedData_v4`, while `@injpass/cli@2.7.0` preserves the typed-data marker across the authorization window. The relay route recognizes known relay errors across module boundaries, and the client extracts only the documented nested error message before falling back to the current status-only error.

**Tech Stack:** Next.js 16, TypeScript, pnpm, Vitest, `@injpass/cli@2.7.0`

## Global Constraints

- Pin `@injpass/cli` to exactly `2.7.0`.
- Do not change the EIP-712 payload or relay request shape.
- Mask unknown server failures as `RELAY_UNAVAILABLE`.
- Do not modify the legacy `package-lock.json`.
- Do not create commits unless the user explicitly requests them.

---

### Task 1: Pin Typed-Data-Capable SDK

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: npm package `@injpass/cli@2.7.0`
- Produces: installed connector that forwards `kind: "typed-data"` and `typedData`

- [ ] **Step 1: Install the exact SDK version**

Run:

```bash
pnpm add --save-exact @injpass/cli@2.7.0
```

Expected: `package.json` contains `"@injpass/cli": "2.7.0"` and `pnpm-lock.yaml` resolves `@injpass/cli@2.7.0`.

- [ ] **Step 2: Verify the resolved dependency**

Run:

```bash
pnpm list @injpass/cli --depth 0
rg -n "'@injpass/cli'|@injpass/cli@2\\.7\\.0" package.json pnpm-lock.yaml
```

Expected: both commands report only version `2.7.0`.

### Task 2: Preserve Known Relay Errors

**Files:**
- Modify: `src/app/api/gift/claims/relay/route.ts`
- Test: `src/app/api/gift/claims/relay/route.test.ts`

**Interfaces:**
- Consumes: thrown `GiftRelayError` or an equivalent cross-module error with `name`, `status`, and `message`
- Produces: `{ error: { code: "RELAY_REJECTED", message: string } }` using the known status

- [ ] **Step 1: Verify the existing regression test fails**

Run:

```bash
pnpm exec vitest run src/app/api/gift/claims/relay/route.test.ts
```

Expected: FAIL because the structurally equivalent `GiftRelayError` returns status 503.

- [ ] **Step 2: Add a narrow relay-error guard**

Add this guard beside the route dependency types:

```ts
function isGiftRelayError(error: unknown): error is GiftRelayError {
  return error instanceof GiftRelayError || (
    error instanceof Error
    && error.name === "GiftRelayError"
    && "status" in error
    && typeof error.status === "number"
  );
}
```

Replace the `instanceof GiftRelayError` branch condition with `isGiftRelayError(error)`. Do not broaden the guard to arbitrary objects or expose messages from unknown errors.

- [ ] **Step 3: Verify the route test passes**

Run:

```bash
pnpm exec vitest run src/app/api/gift/claims/relay/route.test.ts
```

Expected: all three route tests PASS.

### Task 3: Surface Safe Relay Rejections

**Files:**
- Modify: `src/features/claim/gaslessClaim.ts`
- Test: `src/features/claim/gaslessClaim.test.ts`

**Interfaces:**
- Consumes: failed `Response` with optional `{ error: { message: string } }`
- Produces: an `Error` containing the safe relay message or `INJ Gift relayer returned <status>`

- [ ] **Step 1: Verify the existing regression test fails**

Run:

```bash
pnpm exec vitest run src/features/claim/gaslessClaim.test.ts
```

Expected: FAIL because the client throws `INJ Gift relayer returned 400`.

- [ ] **Step 2: Add defensive response parsing**

Add this helper above `claimPacketGasless`:

```ts
async function relayErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as {
      error?: { message?: unknown };
    };
    if (
      payload.error
      && typeof payload.error.message === "string"
      && payload.error.message.trim()
    ) {
      return payload.error.message;
    }
  } catch {}
  return `INJ Gift relayer returned ${response.status}`;
}
```

Replace the failed-response branch with:

```ts
if (!response.ok) {
  throw new Error(await relayErrorMessage(response));
}
```

- [ ] **Step 3: Verify the client test passes**

Run:

```bash
pnpm exec vitest run src/features/claim/gaslessClaim.test.ts
```

Expected: all gasless claim tests PASS.

### Task 4: Validate the Complete Fix

**Files:**
- Verify: `package.json`
- Verify: `pnpm-lock.yaml`
- Verify: `src/app/api/gift/claims/relay/route.ts`
- Verify: `src/features/claim/gaslessClaim.ts`

**Interfaces:**
- Consumes: all deliverables from Tasks 1-3
- Produces: deployable INJ Gift build using typed-data-capable SDK and safe errors

- [ ] **Step 1: Run focused regression tests**

Run:

```bash
pnpm exec vitest run src/app/api/gift/claims/relay/route.test.ts src/features/claim/gaslessClaim.test.ts
```

Expected: both files PASS.

- [ ] **Step 2: Run type checking**

Run:

```bash
pnpm typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 4: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
git diff -- package.json pnpm-lock.yaml src/app/api/gift/claims/relay/route.ts src/features/claim/gaslessClaim.ts
```

Expected: no whitespace errors and only the approved dependency and error-flow changes, alongside the user's existing tests and the design/plan documents.
