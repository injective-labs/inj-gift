# INJ Gift Global Host Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make embedded INJ Gift adopt the active INJ Pass wallet automatically and wait for host authentication instead of failing immediately.

**Architecture:** Keep INJ Pass as the global session source and add a focused authenticated-session wait API to the existing host EIP-1193 provider. Update `connectInjpass()` to use that API while leaving wagmi, provider installation, and transaction routing unchanged.

**Tech Stack:** TypeScript, Next.js 16, React 19, wagmi 3, EIP-1193, Vitest, jsdom

## Global Constraints

- The INJ Pass host is the single source of truth for wallet session state.
- Preserve the existing `injpass-miniapp-v1` protocol.
- Preserve INJ Gift's wagmi and transaction stack.
- Do not copy Omisper's XMTP signer or messaging code.
- Write and observe failing regression tests before production changes.

---

## File Structure

- Modify `src/wallet/injpass/hostProvider.ts`: expose a reusable authenticated-session wait with bounded timeout and listener cleanup.
- Modify `src/wallet/injpass/hostProvider.test.ts`: exercise immediate authentication, delayed authentication, one login request, timeout, and EIP-1193 session events.
- Modify `src/wallet/injpass/provider.ts`: consume the authenticated-session API during embedded connection.
- Create `src/wallet/injpass/provider.test.ts`: verify embedded `connectInjpass()` waits for the global host session and adopts it.

### Task 1: Authenticated host-session state machine

**Files:**
- Modify: `src/wallet/injpass/hostProvider.ts:105-129`
- Test: `src/wallet/injpass/hostProvider.test.ts`

**Interfaces:**
- Consumes: `InjPassHostProvider.waitForSession(timeoutMs?: number)` and `request({ method, params })`.
- Produces: `InjPassHostProvider.waitForAuthenticatedSession(timeoutMs?: number): Promise<InjPassHostSession>`.

- [ ] **Step 1: Write failing tests for immediate and delayed authentication**

Add a session-message helper and tests with these assertions:

```ts
it("returns an authenticated host session without requesting login", async () => {
  dispatchSession(parent, { authenticated: true, address: "0xabc", walletName: "2333_1", chainId: 1439 });
  await expect(provider!.waitForAuthenticatedSession()).resolves.toMatchObject({ address: "0xabc" });
  expect(postedRpcMethods(parent)).not.toContain("injpass_requestLogin");
});

it("requests login once and waits for the next authenticated session", async () => {
  dispatchSession(parent, { authenticated: false, address: null, chainId: 1439 });
  const sessionPromise = provider!.waitForAuthenticatedSession();
  await respondToRpc(parent, "injpass_requestLogin", true);
  dispatchSession(parent, { authenticated: true, address: "0xdef", walletName: "next", chainId: 1439 });
  await expect(sessionPromise).resolves.toMatchObject({ address: "0xdef" });
  expect(postedRpcMethods(parent).filter((method) => method === "injpass_requestLogin")).toHaveLength(1);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/wallet/injpass/hostProvider.test.ts`

Expected: FAIL because `waitForAuthenticatedSession` does not exist.

- [ ] **Step 3: Implement the minimal authenticated-session wait**

Add this public method, using the existing validated session subscription:

```ts
async waitForAuthenticatedSession(timeoutMs = 180_000): Promise<InjPassHostSession> {
  const initial = await this.waitForSession(Math.min(timeoutMs, 10_000));
  if (initial.authenticated && initial.address) return initial;

  await this.request({ method: "injpass_requestLogin" });
  const current = this.session;
  if (current?.authenticated && current.address) return current;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("INJ Pass login was not completed."));
    }, timeoutMs);
    const unsubscribe = this.subscribe((session) => {
      if (!session.authenticated || !session.address) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(session);
    });
  });
}
```

- [ ] **Step 4: Add timeout cleanup and event regression tests**

Use fake timers to assert a missing authenticated session rejects with `INJ Pass login was not completed.`. Register `accountsChanged` and `chainChanged` listeners, dispatch two valid sessions, and assert the new address array and hexadecimal chain ID are emitted.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `npm test -- src/wallet/injpass/hostProvider.test.ts`

Expected: all host-provider tests PASS with zero unhandled rejections.

- [ ] **Step 6: Commit the state machine**

```bash
git add src/wallet/injpass/hostProvider.ts src/wallet/injpass/hostProvider.test.ts
git commit -m "fix: wait for authenticated INJ Pass host session"
```

### Task 2: Use the host state machine during INJ Gift connection

**Files:**
- Modify: `src/wallet/injpass/provider.ts:114-134`
- Create: `src/wallet/injpass/provider.test.ts`

**Interfaces:**
- Consumes: `waitForAuthenticatedSession(timeoutMs?: number): Promise<InjPassHostSession>` from Task 1.
- Produces: unchanged `connectInjpass(): Promise<{ provider: Eip1193Provider; address: string; walletName?: string }>` behavior with host-session waiting.

- [ ] **Step 1: Write a failing embedded-connection test**

Mock the host module before importing `provider.ts`:

```ts
const hostedProvider = {
  isInjPass: true,
  request: vi.fn(),
  waitForAuthenticatedSession: vi.fn().mockResolvedValue({
    authenticated: true,
    address: "0xdef",
    walletName: "2333_1",
    chainId: 1439,
  }),
};

vi.mock("@/wallet/injpass/hostProvider", () => ({
  isInjpassMiniAppHost: () => true,
  getInjpassHostProvider: () => hostedProvider,
}));

it("adopts the authenticated global host session", async () => {
  const result = await connectInjpass();
  expect(hostedProvider.waitForAuthenticatedSession).toHaveBeenCalledOnce();
  expect(result).toMatchObject({ address: "0xdef", walletName: "2333_1" });
});
```

- [ ] **Step 2: Run the provider test and verify RED**

Run: `npm test -- src/wallet/injpass/provider.test.ts`

Expected: FAIL because `connectInjpass()` still calls `waitForSession()`.

- [ ] **Step 3: Replace the immediate-failure branch**

Replace the embedded session handling with:

```ts
const session = await hostedProvider.waitForAuthenticatedSession();
provider = hostedProvider;
connectedWalletMeta = {
  address: session.address,
  walletName: session.walletName,
};
```

Keep the existing `installOnWindow()` call and return shape. Remove the direct login request and immediate error.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
npm test -- src/wallet/injpass/provider.test.ts src/wallet/injpass/hostProvider.test.ts
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits `0`; Vitest reports zero failed tests, TypeScript and ESLint report zero errors, and Next.js completes the production build.

- [ ] **Step 5: Review requirements and diff**

Run:

```bash
git diff --check
git status --short
git diff -- src/wallet/injpass/hostProvider.ts src/wallet/injpass/hostProvider.test.ts src/wallet/injpass/provider.ts src/wallet/injpass/provider.test.ts
```

Confirm the host remains the only session source, login is requested once, connection waits for authenticated state, and no XMTP or protocol changes are present.

- [ ] **Step 6: Commit the provider integration**

```bash
git add src/wallet/injpass/provider.ts src/wallet/injpass/provider.test.ts
git commit -m "fix: sync INJ Gift with global host wallet"
```
