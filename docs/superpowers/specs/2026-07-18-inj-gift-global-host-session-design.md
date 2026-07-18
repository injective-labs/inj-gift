# INJ Gift Global Host Session Design

## Goal

Make INJ Gift connect to the wallet already selected in the INJ Pass host and stay synchronized when the host wallet changes. The behavior should match the proven Omisper mini-app connection flow while retaining INJ Gift's EIP-1193, wagmi, and transaction stack.

## Source of Truth

The INJ Pass host owns the global wallet session. A mini app never treats a cached address as authoritative. Each embedded dApp sends `ready`, receives the current `injpass-miniapp-v1` session, and subscribes to later session updates.

When a user switches dApps, the newly active dApp receives the same global session. When the user switches wallets in INJ Pass, every listening dApp updates to the new address. When the host session ends, dApps clear their connected state and reject outstanding wallet requests.

## Connection State Machine

INJ Gift will use the following flow:

1. Detect that it is embedded by using `injpass_miniapp=1`, persisted mini-app state, and the parent origin supplied by INJ Pass.
2. Send `ready` and wait for the host's current session.
3. If the session is authenticated and contains an address, adopt the host EIP-1193 provider immediately.
4. If the session is unauthenticated, send `injpass_requestLogin` once and wait for a later authenticated session instead of throwing immediately.
5. Complete the wagmi connection only after an authenticated session is available.
6. On later address or chain changes, emit the appropriate EIP-1193 events so consumers refresh their state.
7. On logout, clear the local provider metadata, reject outstanding requests, and allow a fresh connection attempt.

The authenticated-session wait will have an explicit timeout and will unsubscribe on completion or failure. Concurrent connection attempts will continue to share the existing `connectPromise`.

## Components

### Host provider

`src/wallet/injpass/hostProvider.ts` will own the reusable wait-for-authenticated-session behavior. It will subscribe to validated host sessions, resolve only when both `authenticated` and `address` are present, and clean up its listener and timer in every exit path.

### INJ Pass provider adapter

`src/wallet/injpass/provider.ts` will ask the host provider for an authenticated session. It will no longer request login and then immediately throw. Once resolved, it will preserve the existing provider installation and wallet metadata flow.

### UI and wallet controller

The existing `WalletButton` session subscription remains responsible for initiating the wagmi connection when an authenticated host session appears. No Omisper XMTP-specific code will be copied.

## Error Handling

- Missing or invalid host origin: report that the host bridge is unavailable.
- No initial session: retain the existing bounded session timeout.
- Login not completed before the authentication timeout: reject with a clear login timeout error and reset `connectPromise` so retry works.
- Logout or wallet-session termination: reject outstanding RPC requests with EIP-1193 code `4100` and clear local connection state.
- Malformed session messages: ignore them without mutating the last valid session.

## Tests

Tests will be written before production changes and will cover:

1. An already-authenticated host session resolves immediately without requesting login.
2. An unauthenticated host session triggers exactly one login request and resolves after a later authenticated session.
3. Authentication timeout rejects and removes the session listener.
4. Wallet address and chain changes emit EIP-1193 events.
5. Logout clears or invalidates the local connection and permits reconnecting.

After the focused tests pass, the full INJ Gift test suite, type checking, and production build will be run.

## Out of Scope

- Changing the `injpass-miniapp-v1` host protocol.
- Replacing INJ Gift's wagmi or transaction implementation.
- Copying Omisper's XMTP signer or messaging logic.
- Adding per-dApp wallets that diverge from the INJ Pass global wallet.
