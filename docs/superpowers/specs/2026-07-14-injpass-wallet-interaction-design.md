# INJ Gift × INJ Pass Wallet Interaction Design

## Goal

Make and verify both supported INJ Gift wallet paths against `inj-pass-frontend`:

1. Standalone INJ Gift opens the INJ Pass embedded connector and authorization window.
2. INJ Gift runs as an INJ Pass mini app and relays wallet RPC requests to its host.

Each path must connect the same wallet, complete a message signature, broadcast a real Injective EVM testnet transaction, and return a successful transaction hash and receipt.

## Scope

The work covers wallet connection, request transport, authorization, EIP-1193 responses, and testnet verification. It does not redesign either product UI, add wallet types, or change contract behavior unrelated to wallet transport.

Sensitive environment values may be read at runtime but must not be printed, committed, included in screenshots, or copied into test artifacts.

## Architecture

### Standalone path

`INJ Gift WalletButton` → `@injpass/cli InjPassConnector` → `inj-pass-frontend /embed` → `inj-pass-frontend /auth`

The connector opens the INJ Pass experience, waits for wallet selection and unlock, and exposes an EIP-1193 provider to INJ Gift. INJ Gift must use that provider even when another extension owns `window.ethereum`.

### Mini-app path

`inj-pass-frontend mini-app iframe` → `INJ Gift hostProvider` → `postMessage RPC` → `INJ Pass wallet authorization and broadcaster`

The host sends the authenticated wallet session to the iframe. INJ Gift wraps the bridge as an EIP-1193 provider. Every RPC request and response is correlated by request ID and restricted to the expected source window and origin.

## Verification Flow

For each path:

1. Start both applications on separate localhost ports with Injective EVM testnet configuration.
2. Connect through the visible wallet UI and select/unlock the funded test wallet.
3. Confirm INJ Gift and INJ Pass report the same EVM address and expected chain ID.
4. Submit a message-signing request and verify the returned signature recovers the connected address.
5. Submit a zero-value self-transfer so only testnet gas is spent.
6. Capture the transaction hash and query the configured RPC until the receipt confirms success.

If INJ Gift can only reach transaction authorization through a contract action, use the smallest valid testnet contract operation instead of expanding production behavior solely for testing.

## Error Handling

The integration must surface distinct failures for a blocked popup, invalid origin or source, locked/missing wallet, user rejection, wrong chain, insufficient balance, request timeout, and RPC broadcast failure.

Errors must be returned through the same request ID as the initiating RPC request. Pending requests must be cleaned up on success, error, timeout, logout, or window closure. A rejected request must not leave INJ Gift waiting for the generic timeout.

## Testing Strategy

Use test-driven development for any production change:

1. Add the smallest protocol-level regression test for the reproduced failure.
2. Run it and confirm it fails for the intended reason.
3. Implement one root-cause fix.
4. Run the focused test and the surrounding suite.

Protocol tests cover standalone connector request/response behavior and mini-app session/RPC correlation. Real-browser verification covers both visible UI paths and the actual testnet transaction. Build, typecheck, lint, and relevant project tests are run before completion claims.

## Completion Criteria

- Both wallet paths connect and display the same selected EVM address.
- Each path returns a signature that recovers that address.
- Each path broadcasts a real Injective EVM testnet transaction.
- Both transaction hashes have successful receipts from the configured RPC.
- Relevant automated tests, type checks, lint checks, and production builds pass.
- No secret value appears in source control, command output, screenshots, or test artifacts.
