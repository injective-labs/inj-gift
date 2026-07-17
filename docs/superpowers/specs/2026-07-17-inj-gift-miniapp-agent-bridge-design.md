# INJ Gift Mini-dApp and Agent Bridge Design

## Goal

Connect INJ Gift to INJ Pass through one mini-dApp protocol so both user-driven and AI-driven red-packet operations use the same wallet session and INJ Gift transaction implementation.

The completed integration must support:

1. Manually creating and claiming red packets inside the INJ Pass embedded INJ Gift page.
2. Creating, claiming, and querying red packets from INJ Pass AI Chat.
3. Standalone INJ Gift wallet connection without regression.

## Repository and Branch Scope

- `inj-pass-frontend`, branch `dev`: host wallet session/RPC handling, AI command routing, and result presentation.
- `inj-gift`, branch `main`: hosted EIP-1193 provider, shared red-packet execution service, embedded UI integration, and agent-command handling.

No remote `main` branch is pushed as part of implementation unless explicitly requested.

## Architecture

### Manual embedded interaction

INJ Pass embeds INJ Gift with `injpass_miniapp=1` and `injpass_host_origin=<origin>`. INJ Gift detects that mode, posts `ready`, receives the authenticated wallet session, and exposes the host bridge as an EIP-1193 provider.

When the user creates or claims a red packet in the visible INJ Gift UI, INJ Gift prepares the contract request and submits it through that provider. INJ Pass performs wallet authorization, signing, and broadcasting, then returns a correlated `rpc-response`.

### AI Chat interaction

INJ Pass parses `@INJ Gift` commands but does not sign or execute the contract locally. It loads the registered INJ Gift mini-dApp URL in a hidden command runner and sends an `agent-command` over `injpass-miniapp-v1`.

INJ Gift validates the parent window and origin, then dispatches `create`, `claim`, or `query` into the same application service used by the visible UI. It returns an `agent-command-result` containing a stable result key and structured data such as transaction hash, packet ID, password, amount, and status. INJ Pass formats that result for AI Chat.

## Protocol

### Host session

The existing `session` message remains the source of wallet truth. It contains authentication state, address, wallet name, and chain ID. Address or chain changes emit EIP-1193 `accountsChanged` or `chainChanged` events inside INJ Gift.

### Wallet RPC

INJ Gift sends `rpc-request` with a unique request ID, method, and params. INJ Pass responds with exactly one `rpc-response` carrying either `result` or an EIP-1193-compatible error. Requests are accepted only from the configured parent origin and parent window.

### Agent commands

Supported actions are:

- `create`: amount, count, password, duration, and random/equal mode.
- `claim`: packet ID and password.
- `query`: packet ID.

The agent bridge rejects missing or invalid parameters before requesting wallet authorization. Transaction operations require an authenticated host session. Query operations use the configured public client and do not require a signature.

## Shared INJ Gift Execution Boundary

Contract address, ABI, validation, transaction preparation, receipt parsing, and domain error mapping live in INJ Gift. React hooks and the agent bridge call this shared service. They must not maintain separate contract implementations.

The frontend removes the direct private-key INJ Gift execution path after the mini-dApp agent path is covered by tests. It retains natural-language parsing and localized result formatting.

## Connection Lifecycle

- Embedded mode uses the host provider and must not invoke the standalone `/embed` or `/auth` connector flow.
- Standalone mode continues to use the existing INJ Pass connector.
- Disconnect clears the hosted session and wagmi connection state.
- A new wallet session reconnects without reloading the parent application.
- Pending requests are removed after success, rejection, timeout, logout, or component teardown.

## Error Handling

The integration distinguishes:

- INJ Pass login required.
- User rejected authorization (`4001`).
- Origin/source validation failure.
- Wrong chain.
- Insufficient INJ for value plus gas.
- Invalid or closed red packet.
- Incorrect password.
- Request timeout or unavailable mini-dApp.

Failures return through the initiating request or command ID. Neither the visible UI nor AI Chat may remain indefinitely in a connecting or working state.

## Testing

Implementation follows test-driven development.

INJ Gift tests cover:

- Host session and correlated RPC validation.
- Session changes and disconnect cleanup.
- Manual create/claim calls using the hosted provider.
- Agent create/claim/query dispatch and structured results.
- Rejection and timeout cleanup.

Frontend tests cover:

- INJ Gift commands use the registered mini-dApp URL.
- Agent-command request/result correlation.
- Local private-key execution is no longer used for INJ Gift.
- Localized success, login-required, rejection, and failure messages.

Both repositories must pass relevant unit tests, type checking, linting where configured, and production builds.

## Acceptance Criteria

- Embedded INJ Gift displays the current INJ Pass wallet without opening a second login flow.
- A user can manually create and claim a testnet red packet from the embedded UI.
- AI Chat can create a red packet and return its transaction hash, packet ID, and password.
- AI Chat can claim a red packet using its ID and password and return the transaction hash and claimed amount.
- AI Chat can query packet state without wallet authorization.
- Wallet disconnect and switching do not leave stale accounts or permanent loading states.
- Standalone INJ Gift remains functional.
- No private key crosses the mini-dApp boundary or is sent to INJ Gift.
