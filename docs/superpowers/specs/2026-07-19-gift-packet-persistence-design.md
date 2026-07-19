# Gift Packet Persistence Design

## Goal

Persist the minimum index required to recover each wallet's created Gift packets across browsers and devices. Gift shares Omisper's PostgreSQL instance and `DATABASE_URL`, but owns its server API, tables, migrations, and business logic independently.

## Ownership Boundary

- `inj-gift` owns all Gift database code and API routes.
- Omisper's API, Prisma schema, and migrations are unchanged.
- Gift uses server-only `DATABASE_URL`; it is never exposed through a `NEXT_PUBLIC_` variable or sent to the browser.
- Gift tables use quoted names beginning with `gift-`.

## Persisted Data

Create one business table, `"gift-packets"`, with:

- `packet_id`
- `creator_address`
- `chain_id`
- `contract_address`
- `create_tx_hash`
- `created_block_number`
- `created_block_timestamp`
- `created_at`
- `updated_at`

The unique identity is `(chain_id, contract_address, packet_id)`. EVM addresses and contract addresses are normalized to lowercase before storage and lookup.

No other current Gift data belongs in PostgreSQL:

- Amount, token, distribution mode, counts, claimed amount, expiration, active state, and refund state remain canonical on-chain and are read from the contract.
- Passcodes are never persisted outside the contract interaction that already exists.
- Form drafts, copy state, loading state, language, and other UI preferences remain local or ephemeral.
- Claim history is not needed by the current product and can be recovered from chain events if a future feature requires it.

## Database Access and Migrations

Use `pg` from Next.js server-only modules. Do not introduce Prisma into `inj-gift`, because two independent Prisma projects sharing one database would also share `_prisma_migrations` and could interfere with each other's migration history.

Gift owns ordered SQL migration files and a `"gift-schema-migrations"` table. The migration runner applies each Gift migration once within a transaction. The initial migration creates `"gift-packets"`, its unique constraint, and an index on `(creator_address, created_block_timestamp DESC)`.

## API

### `POST /api/gift/packets`

Request fields:

- `packetId`: bytes32 hex string
- `txHash`: transaction hash

The server uses `GIFT_EVM_RPC_URL`, `GIFT_EVM_CHAIN_ID`, and `GIFT_EVM_CONTRACT_ADDRESS` to verify:

1. The transaction receipt exists and succeeded.
2. The transaction targeted the configured Gift contract.
3. The receipt contains the expected `RedPacketCreated` event for `packetId`.
4. The contract's packet record has a non-empty creator.

The server derives the creator, block number, block timestamp, chain ID, and contract address. It never trusts a creator address supplied by the browser. A valid packet is idempotently upserted and returned.

### `GET /api/gift/packets?creator=0x...`

Validate and normalize the creator address, then return that wallet's packet index ordered by chain creation time descending. Reading the index is public because all returned identifiers and ownership are already public on-chain.

## Client Data Flow

- After a create transaction succeeds and produces both `packetId` and `txHash`, call the POST endpoint.
- If persistence succeeds, the database becomes the durable packet index.
- If persistence fails, write only `{ packetId, txHash }` to an address-scoped local outbox and keep the transaction success UI intact.
- On wallet connection, wallet change, page load, and manual refresh, retry that wallet's outbox before fetching its database records.
- On wallet disconnect, clear the displayed packet list immediately.
- The home Mine panel, `/create`, and `/packet` use one shared client repository/hook rather than duplicating LocalStorage access.

## Legacy Migration

The old `injgift.myPackets` list has no owner field. For each wallet address, attempt each legacy `{ id, txHash }` through the verified POST endpoint. The server derives the real creator from chain data, so records cannot be assigned to the wrong wallet.

Only entries containing both a valid packet ID and transaction hash are eligible for automatic migration. Record a per-wallet migration marker after all eligible entries have either synced successfully or were verified as belonging to another creator. Keep malformed or unverifiable legacy entries untouched so users can still copy their packet IDs manually.

## Delete Semantics

Do not provide a database delete endpoint. A confirmed on-chain creation remains part of the wallet's history. Remove the current local-only delete and clear-all controls from persisted packet lists, because they would be misleading and would reappear on the next database refresh.

## Error Handling

- Database or RPC failures return a non-2xx response with a stable error code and no sensitive connection details.
- Duplicate POST requests are idempotent.
- Client sync failures stay in the local outbox and can be retried without duplicating database rows.
- A database persistence failure never changes an already successful blockchain transaction into a failed transaction in the UI.

## Testing and Verification

- Unit-test request validation, normalization, outbox behavior, address changes, and legacy eligibility.
- API-test successful verification/upsert, duplicate requests, wrong contract, failed receipt, missing creation event, and creator filtering with database and RPC boundaries stubbed.
- Verify that the home Mine panel and `/packet` switch records immediately when the connected wallet changes and clear on disconnect.
- Run Gift tests, type checking, targeted lint, and production build.
- Apply the initial migration to a test database before production deployment.

