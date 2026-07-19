# INJ Pass-Only Wallet Routing Design

## Goal

Make INJ Pass the only wallet that `inj-gift` can use. Opening a gift link directly and clicking claim while disconnected must start the INJ Pass connection flow. The application must never fall back to MetaMask, OKX, Keplr, or another browser-injected wallet.

## Scope

- Apply the policy to every signing action, including claim, create, and refund.
- Keep packet/status reads wallet-free by using the configured read-only RPC provider.
- Remove signing fallbacks through `window.ethereum`, generic injected-wallet discovery, and unused extension-wallet providers.
- Preserve the existing INJ Pass embedded-wallet and INJ Pass mini-app host flows.
- Preserve existing transaction lifecycle and user-facing error normalization.

## Architecture

INJ Pass remains the single source of the live EIP-1193 signing provider. A shared connection boundary ensures that provider exists before a signing action creates an ethers signer. The EVM wallet layer accepts only the provider returned by the INJ Pass integration; it does not inspect `window.ethereum`.

The flow for every write is:

1. The page or adapter starts a create, claim, or refund action.
2. The shared boundary calls the idempotent INJ Pass connection function.
3. A successful connection supplies the INJ Pass EIP-1193 provider and account.
4. `EvmWallet` constructs an ethers `BrowserProvider` from that provider and obtains its signer.
5. The contract wrapper submits the transaction through INJ Pass.

If the user cancels or INJ Pass is unavailable, the action stops and the existing normalized error is shown. No alternate provider is attempted.

Read-only calls such as loading packet details continue through `JsonRpcProvider` and never initiate wallet connection.

## Wallet Surface Cleanup

The application will be audited for all browser-wallet entry points, including:

- direct `window.ethereum` access;
- `eth_requestAccounts` calls not bound to the INJ Pass provider;
- generic Wagmi injected connectors or EIP-6963 discovery;
- Cosmos Kit/Keplr providers and hooks that are mounted or reachable in the current EVM application;
- legacy hooks or contract helpers that can initiate a separate wallet connection.

Code that is part of an active INJ Pass compatibility shim may expose the INJ Pass provider shape, but application signing code must not obtain its provider from the browser global.

## Error Handling

- User cancellation remains a user-rejected connection error.
- Missing INJ Pass configuration/provider becomes an INJ Pass connection error.
- Network-switch and transaction errors continue through the existing normalization layer.
- None of these errors triggers a fallback wallet.

## Testing

Regression tests will establish that:

- a disconnected signing action initiates INJ Pass connection;
- an injected fake MetaMask provider on `window.ethereum` never receives `eth_requestAccounts`, signing, chain-switch, or transaction calls;
- the signer is constructed from the INJ Pass provider;
- connection cancellation stops the transaction without trying another provider;
- packet reads remain wallet-free;
- existing unit tests, linting, type checking, and the production build pass.

Tests will be written first and observed failing before production changes are made.

## Non-Goals

- Supporting multiple selectable wallets.
- Changing smart contracts or backend packet persistence.
- Redesigning wallet or transaction UI.
- Changing INJ Pass authentication or key custody.

## Success Criteria

With MetaMask, OKX, Keplr, or any combination installed and locked, no `inj-gift` user action opens those extensions. A disconnected create, claim, or refund action opens INJ Pass, and all resulting signatures and transactions are routed only through the connected INJ Pass provider.
