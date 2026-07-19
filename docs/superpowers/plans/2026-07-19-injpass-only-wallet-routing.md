# INJ Pass-Only Wallet Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every `inj-gift` signing action through INJ Pass and ensure no browser extension wallet can be opened or queried.

**Architecture:** `connectInjpass()` is the only connection boundary and `getInjpassEip1193()` is the only provider source used for signing or account display. `EvmWallet` connects INJ Pass before constructing an ethers provider, while read-only packet queries remain on `JsonRpcProvider`. Legacy Cosmos/Keplr and browser-global compatibility paths are removed.

**Tech Stack:** Next.js 16, React 19, TypeScript, ethers 6, Wagmi 3, Vitest, `@injpass/cli`

## Global Constraints

- INJ Pass is the only supported wallet.
- Create, claim, and refund must initiate INJ Pass when disconnected.
- No signing or account path may fall back to `window.ethereum`, EIP-6963, MetaMask, OKX, Keplr, WalletConnect, or another injected provider.
- Packet/status reads remain wallet-free through the configured read-only RPC.
- Cancellation or INJ Pass failure stops the action and uses existing normalized errors.
- Preserve embedded INJ Pass and INJ Pass mini-app host behavior.

---

## File Structure

- `src/stacks/evm/wallet.ts`: owns ethers provider/signer creation and accepts only an INJ Pass provider.
- `src/stacks/evm/wallet.test.ts`: proves disconnected connection routing and rejects browser-global fallback.
- `src/stacks/evm/adapter.test.ts`: proves write actions cross the wallet connection boundary while reads do not.
- `src/wallet/injpass/provider.ts`: owns embedded/host INJ Pass connection state without mutating browser wallet globals.
- `src/wallet/injpass/provider.test.ts`: proves connection does not replace or call an installed extension provider.
- `src/app/packet/[id]/page.tsx`: reads the displayed account only from INJ Pass.
- `src/hooks/useInjWallet.ts`, `src/providers/WalletProvider.tsx`, `src/features/redpacket/hooks/*.ts`: unused legacy Cosmos/Keplr connection surface to delete.
- `package.json`, `pnpm-lock.yaml`: remove extension-wallet dependencies that are no longer reachable.

### Task 1: Make `EvmWallet` connect only through INJ Pass

**Files:**
- Create: `src/stacks/evm/wallet.test.ts`
- Modify: `src/stacks/evm/wallet.ts:1-60`
- Test: `src/stacks/evm/wallet.test.ts`

**Interfaces:**
- Consumes: `connectInjpass(): Promise<{ provider: Eip1193Provider; address: string; walletName?: string }>`.
- Produces: unchanged `EvmWallet.connect(): Promise<void>` and `EvmWalletState`; `connect()` now guarantees the signer comes from the returned INJ Pass provider.

- [ ] **Step 1: Write the failing provider-routing tests**

Create `src/stacks/evm/wallet.test.ts` with hoisted fakes for `connectInjpass`, `getInjpassEip1193`, and ethers `BrowserProvider`. Cover two behaviors:

```ts
it("connects INJ Pass before requesting an account", async () => {
  const wallet = new EvmWallet();
  await wallet.connect();
  expect(connectInjpass).toHaveBeenCalledOnce();
  expect(browserProviderConstructor).toHaveBeenCalledWith(injpassProvider);
  expect(providerSend).toHaveBeenCalledWith("eth_requestAccounts", []);
});

it("never calls an injected browser wallet", async () => {
  const extensionRequest = vi.fn();
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: { isMetaMask: true, request: extensionRequest },
  });
  const wallet = new EvmWallet();
  await wallet.connect();
  expect(extensionRequest).not.toHaveBeenCalled();
  expect(browserProviderConstructor).toHaveBeenCalledWith(injpassProvider);
});
```

Mock `getNetwork()` to return the configured chain so the tests isolate provider selection.

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm test src/stacks/evm/wallet.test.ts`

Expected: FAIL because current `connect()` does not call `connectInjpass()` and may construct from `window.ethereum` before INJ Pass exists.

- [ ] **Step 3: Implement the minimal INJ Pass-only connection**

In `src/stacks/evm/wallet.ts`, import `connectInjpass`, remove the `window.ethereum` fallback, and make provider selection asynchronous:

```ts
private async ensureProvider(): Promise<BrowserProvider> {
  const { provider } = await connectInjpass();
  this.provider = new ethers.BrowserProvider(provider);
  return this.provider;
}

async connect(): Promise<void> {
  const provider = await this.ensureProvider();
  // existing account, signer, and network logic remains
}
```

Remove diagnostic logging and all comments describing `window.ethereum` as a fallback.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm test src/stacks/evm/wallet.test.ts src/stacks/evm/adapter.test.ts`

Expected: all tests pass and the fake extension request count remains zero.

- [ ] **Step 5: Commit**

```bash
git add src/stacks/evm/wallet.ts src/stacks/evm/wallet.test.ts
git commit -m "fix: route gift transactions through INJ Pass"
```

### Task 2: Remove browser-global compatibility from the INJ Pass provider

**Files:**
- Modify: `src/wallet/injpass/provider.ts:1-190`
- Modify: `src/wallet/injpass/provider.test.ts`
- Test: `src/wallet/injpass/provider.test.ts`

**Interfaces:**
- Preserves: `connectInjpass`, `getInjpassEip1193`, `isInjpassConnected`, and `disconnectInjpass` public signatures.
- Changes: connection state remains module-local/host-local and is never installed onto `window.ethereum`.

- [ ] **Step 1: Write a failing non-mutation test**

Add an embedded-connector test setup that supplies a fake `InjPassConnector`, then assert:

```ts
it("does not replace or call an installed extension provider", async () => {
  const extension = { isMetaMask: true, request: vi.fn() };
  Object.defineProperty(window, "ethereum", { configurable: true, value: extension });

  const result = await connectInjpass();

  expect(window.ethereum).toBe(extension);
  expect(extension.request).not.toHaveBeenCalled();
  expect(getInjpassEip1193()).toBe(result.provider);
});
```

- [ ] **Step 2: Run the provider test and verify RED**

Run: `pnpm test src/wallet/injpass/provider.test.ts`

Expected: FAIL because `connectInjpass()` currently calls `installOnWindow()` and attempts to replace `window.ethereum`.

- [ ] **Step 3: Remove browser-global installation**

Delete `installOnWindow()` and both calls to it. Update module documentation to state that consumers must use `getInjpassEip1193()` or the provider returned by `connectInjpass()` directly.

- [ ] **Step 4: Run provider and host tests**

Run: `pnpm test src/wallet/injpass/provider.test.ts src/wallet/injpass/hostProvider.test.ts src/wallet/injpass/agentBridge.test.ts`

Expected: all tests pass; embedded and mini-app host sessions remain functional.

- [ ] **Step 5: Commit**

```bash
git add src/wallet/injpass/provider.ts src/wallet/injpass/provider.test.ts
git commit -m "refactor: keep INJ Pass provider isolated"
```

### Task 3: Remove remaining alternate-wallet account and connection paths

**Files:**
- Modify: `src/app/packet/[id]/page.tsx:110-140`
- Delete: `src/providers/WalletProvider.tsx`
- Delete: `src/hooks/useInjWallet.ts`
- Delete: `src/features/redpacket/hooks/useCreateRedPacket.ts`
- Delete: `src/features/redpacket/hooks/useClaimRedPacket.ts`
- Delete: `src/features/redpacket/hooks/useRefundRedPacket.ts`
- Modify: `src/wallet/config/wallets.ts`
- Modify: `src/wallet/hooks/useWalletController.ts`
- Modify: `src/providers/EvmProvider.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Packet ownership display consumes only `getInjpassEip1193(): Eip1193Provider | undefined`.
- Active EVM adapter and Wagmi INJ Pass connector interfaces remain unchanged.

- [ ] **Step 1: Add a source-policy regression test**

Create `src/wallet/injpass/onlyInjpassPolicy.test.ts` that scans active application TypeScript source and fails when forbidden alternate-wallet entry points exist outside test/type declarations:

```ts
const forbidden = [
  /window\.ethereum/,
  /@cosmos-kit\/keplr-extension/,
  /@walletconnect\/ethereum-provider/,
];

it("contains no alternate-wallet runtime entry points", () => {
  for (const file of runtimeSourceFiles) {
    expect(readFileSync(file, "utf8"), file).not.toMatchAny(forbidden);
  }
});
```

Implement the assertion with a normal loop because Vitest has no built-in `not.toMatchAny`. Exclude `*.test.*`, `src/types/ethereum.d.ts`, and generated files. Allow `injected()` only in `wagmiConfig.ts`, where its explicit target is `getInjpassEip1193()`.

- [ ] **Step 2: Run the policy test and verify RED**

Run: `pnpm test src/wallet/injpass/onlyInjpassPolicy.test.ts`

Expected: FAIL on the packet page browser-global fallback and legacy Keplr provider.

- [ ] **Step 3: Remove runtime paths**

In the packet page, replace:

```ts
const eip1193 = getInjpassEip1193() ?? window.ethereum;
```

with:

```ts
const eip1193 = getInjpassEip1193();
```

Delete the unused Cosmos wallet provider, `useInjWallet`, and its three unused feature hooks. Remove stale comments referring to global injection in `wallets.ts`, `useWalletController.ts`, and `EvmProvider.tsx`.

Run:

```bash
pnpm remove @cosmos-kit/keplr-extension @cosmos-kit/react @keplr-wallet/types @walletconnect/ethereum-provider
```

This updates `package.json` and `pnpm-lock.yaml`. Retain CosmJS libraries still used by password utilities, the Injective client, and legacy contract types.

- [ ] **Step 4: Run policy test, typecheck, and focused wallet tests**

Run: `pnpm test src/wallet/injpass/onlyInjpassPolicy.test.ts src/stacks/evm/wallet.test.ts src/stacks/evm/adapter.test.ts && pnpm typecheck`

Expected: tests and TypeScript compilation pass with no missing legacy imports.

- [ ] **Step 5: Commit**

```bash
git add src package.json pnpm-lock.yaml
git commit -m "chore: remove alternate wallet entry points"
```

### Task 4: Full verification

**Files:**
- Modify only if verification reveals a regression in the files already listed.

**Interfaces:**
- Verifies the completed public behavior; produces no new interface.

- [ ] **Step 1: Audit provider access**

Run:

```bash
rg -n "window\.ethereum|eth_requestAccounts|@cosmos-kit|keplr|walletconnect|EIP-6963" src package.json
```

Expected: no runtime extension-wallet path. `eth_requestAccounts` may appear only in `EvmWallet`, where the `BrowserProvider` was constructed from `connectInjpass().provider`; policy terms may appear in tests/comments that document their prohibition.

- [ ] **Step 2: Run the full automated suite**

Run: `pnpm test`

Expected: zero failed tests.

- [ ] **Step 3: Run static verification**

Run: `pnpm lint && pnpm typecheck`

Expected: both commands exit 0.

- [ ] **Step 4: Run the production build**

Run: `pnpm build`

Expected: Next.js production build exits 0.

- [ ] **Step 5: Review the final diff**

Run: `git diff HEAD~3 --check && git status --short`

Expected: no whitespace errors and only intentional files are changed. Do not commit unrelated existing work.

- [ ] **Step 6: Commit any verification-only corrections**

If verification required corrections, add only the already-scoped wallet files changed by that correction and commit them with `git commit -m "test: verify INJ Pass-only wallet routing"`. If no correction was required, do not create an empty commit.
