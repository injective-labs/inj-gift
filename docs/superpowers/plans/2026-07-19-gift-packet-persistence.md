# Gift Packet Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every connected wallet a durable, cross-device index of its created Gift packets using Gift-owned tables in the PostgreSQL database shared with Omisper.

**Architecture:** `inj-gift` owns a small `pg` repository, SQL migration runner, verified Next.js API, and address-aware client hook. PostgreSQL stores only the creator-to-packet chain index; the contract remains canonical for packet state, while an address-scoped browser outbox retries temporary persistence failures.

**Tech Stack:** Next.js 16 route handlers, React 19, TypeScript, PostgreSQL (`pg`), viem, wagmi, Zod, Vitest, Testing Library

## Global Constraints

- Omisper's API, Prisma schema, models, and migrations must remain unchanged.
- Gift uses server-only `DATABASE_URL`; never expose it through a `NEXT_PUBLIC_` variable.
- Every Gift-owned PostgreSQL table name starts with quoted `gift-`.
- Store only packet ID, creator, chain/contract identity, creation transaction, block number, block timestamp, and database timestamps.
- Never store packet passcodes, form drafts, or contract-derived packet state.
- Server derives creator and chain metadata from the configured RPC and contract; never trust a browser-supplied creator.
- A successful chain transaction remains successful when database synchronization fails.
- Do not offer delete or clear-all behavior for confirmed on-chain creation history.

---

### Task 1: Gift-owned database migrations and repository

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`
- Create: `db/migrations/001-create-gift-packets.sql`
- Create: `scripts/gift-migrate.mjs`
- Create: `src/server/gift/db.ts`
- Create: `src/server/gift/packetRepository.ts`
- Create: `src/server/gift/packetRepository.test.ts`

**Interfaces:**
- Produces `GiftPacketRecord`, `GiftQueryable`, `listGiftPackets(db, creatorAddress)`, and `upsertGiftPacket(db, record)`.
- Produces `getGiftPool()` for route handlers only.

- [ ] **Step 1: Install PostgreSQL dependencies**

Run:

```bash
pnpm add pg
pnpm add -D @types/pg
```

Add `"db:migrate:gift": "node scripts/gift-migrate.mjs"` to `scripts` in `package.json`.

- [ ] **Step 2: Write failing repository tests**

Create `src/server/gift/packetRepository.test.ts` with a fake query function and these assertions:

```ts
import { describe, expect, it, vi } from "vitest";
import { listGiftPackets, upsertGiftPacket } from "./packetRepository";

const record = {
  packetId: `0x${"11".repeat(32)}`,
  creatorAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  chainId: 1439,
  contractAddress: "0x1234567890123456789012345678901234567890",
  createTxHash: `0x${"22".repeat(32)}`,
  createdBlockNumber: "123",
  createdBlockTimestamp: "2026-07-19T00:00:00.000Z",
};

it("upserts the normalized chain identity", async () => {
  const query = vi.fn().mockResolvedValue({ rows: [record] });
  await upsertGiftPacket({ query }, record);
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO "gift-packets"'),
    expect.arrayContaining([record.packetId, record.creatorAddress]),
  );
});

it("lists one normalized creator newest first", async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  await listGiftPackets({ query }, record.creatorAddress.toUpperCase());
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining("ORDER BY created_block_timestamp DESC"),
    [record.creatorAddress],
  );
});
```

- [ ] **Step 3: Run the tests and verify RED**

Run: `pnpm test -- src/server/gift/packetRepository.test.ts`

Expected: FAIL because `packetRepository.ts` does not exist.

- [ ] **Step 4: Add the initial SQL migration**

Create `db/migrations/001-create-gift-packets.sql`:

```sql
CREATE TABLE IF NOT EXISTS "gift-packets" (
  packet_id TEXT NOT NULL,
  creator_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  contract_address TEXT NOT NULL,
  create_tx_hash TEXT NOT NULL,
  created_block_number BIGINT NOT NULL,
  created_block_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, contract_address, packet_id),
  UNIQUE (chain_id, create_tx_hash),
  CHECK (creator_address = LOWER(creator_address)),
  CHECK (contract_address = LOWER(contract_address))
);

CREATE INDEX IF NOT EXISTS "gift-packets-creator-created-idx"
  ON "gift-packets" (creator_address, created_block_timestamp DESC);
```

- [ ] **Step 5: Add an independent migration runner**

Create `scripts/gift-migrate.mjs` using `pg.Pool`. It must:

```js
await client.query(`CREATE TABLE IF NOT EXISTS "gift-schema-migrations" (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);
```

Then read sorted `.sql` files from `db/migrations`, start a transaction for each missing filename, execute its SQL, insert the filename into `"gift-schema-migrations"`, commit, and roll back on failure. Throw `DATABASE_URL is required` before opening a pool when the variable is absent, and always close the pool in `finally`.

- [ ] **Step 6: Implement the pool and repository**

Create `src/server/gift/db.ts` with a development-safe singleton:

```ts
import { Pool } from "pg";

const globalForGiftDb = globalThis as typeof globalThis & { giftDbPool?: Pool };

export function getGiftPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return (globalForGiftDb.giftDbPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  }));
}
```

Create `packetRepository.ts` with camel-case domain types, a minimal `GiftQueryable` interface, explicit SQL column aliases, lowercase address normalization, `ON CONFLICT (chain_id, contract_address, packet_id) DO UPDATE`, and no delete function.

- [ ] **Step 7: Verify GREEN and commit**

Run: `pnpm test -- src/server/gift/packetRepository.test.ts && pnpm typecheck`

Expected: repository tests pass and TypeScript exits 0.

```bash
git add package.json pnpm-lock.yaml .env.example db scripts src/server/gift
git commit -m "feat: add gift packet database repository"
```

---

### Task 2: Verify packet creation on-chain and expose Gift API routes

**Files:**
- Create: `src/server/gift/config.ts`
- Create: `src/server/gift/verifyCreatedPacket.ts`
- Create: `src/server/gift/verifyCreatedPacket.test.ts`
- Create: `src/app/api/gift/packets/route.ts`
- Create: `src/app/api/gift/packets/route.test.ts`

**Interfaces:**
- Produces `verifyCreatedPacket(input): Promise<GiftPacketRecord>`.
- Produces `POST(request): Promise<Response>` and `GET(request): Promise<Response>`.

- [ ] **Step 1: Write failing verifier tests**

Test a dependency-injected `GiftChainReader` containing `getTransaction`, `getTransactionReceipt`, `getBlock`, and `readContract`. Cover:

```ts
it("derives the creator and block metadata from a valid creation", async () => {
  const result = await verifyCreatedPacket(validInput, validConfig, validReader);
  expect(result).toMatchObject({
    packetId: validInput.packetId,
    creatorAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    chainId: 1439,
    createdBlockNumber: "123",
  });
});

it.each([
  ["failed receipt", { receiptStatus: "reverted" }, "TRANSACTION_FAILED"],
  ["wrong contract", { transactionTo: otherAddress }, "WRONG_CONTRACT"],
  ["missing event", { logs: [] }, "CREATION_EVENT_NOT_FOUND"],
  ["creator mismatch", { contractCreator: otherAddress }, "CREATOR_MISMATCH"],
])("rejects %s", async (_name, override, code) => {
  await expect(verifyWith(override)).rejects.toMatchObject({ code });
});
```

- [ ] **Step 2: Run verifier tests and verify RED**

Run: `pnpm test -- src/server/gift/verifyCreatedPacket.test.ts`

Expected: FAIL because the verifier does not exist.

- [ ] **Step 3: Implement server configuration and verification**

In `config.ts`, validate `GIFT_EVM_RPC_URL`, positive integer `GIFT_EVM_CHAIN_ID`, and a 20-byte `GIFT_EVM_CONTRACT_ADDRESS` with Zod.

In `verifyCreatedPacket.ts`:

- Validate `packetId` and `txHash` as 32-byte hex.
- Use viem `createPublicClient` for the production `GiftChainReader`.
- Require receipt status `success` and transaction `to` equal the configured contract.
- Decode `RedPacketCreated` from receipt logs with `parseEventLogs` and require its `id` to equal `packetId`.
- Read `redPackets(packetId)` and require its creator to match the event creator.
- Fetch the block timestamp and return only `GiftPacketRecord` fields.
- Throw errors with stable codes and no RPC URL or database details.

- [ ] **Step 4: Verify verifier GREEN**

Run: `pnpm test -- src/server/gift/verifyCreatedPacket.test.ts`

Expected: all verifier cases pass.

- [ ] **Step 5: Write failing route tests**

Extract factories `createPostGiftPacket({ verify, upsert })` and `createGetGiftPackets({ list })`. Test:

```ts
it("upserts only the verified record", async () => {
  const response = await handler(new Request(url, {
    method: "POST",
    body: JSON.stringify({ packetId, txHash }),
  }));
  expect(response.status).toBe(201);
  expect(upsert).toHaveBeenCalledWith(verifiedRecord);
});

it("rejects a browser-supplied creator field", async () => {
  const response = await handler(new Request(url, {
    method: "POST",
    body: JSON.stringify({ packetId, txHash, creator: address }),
  }));
  expect(response.status).toBe(400);
});

it("normalizes the creator query", async () => {
  await getHandler(new Request(`${url}?creator=${address.toUpperCase()}`));
  expect(list).toHaveBeenCalledWith(address);
});
```

- [ ] **Step 6: Implement route handlers**

Use strict Zod objects. POST returns `{ packet }` with status 201 for a new or idempotent verified upsert. GET returns `{ packets }`. Map invalid input to 400, missing chain data to 404, failed/wrong-contract validation to 422, and infrastructure failures to 503 with `{ error: { code, message } }`.

- [ ] **Step 7: Verify and commit**

Run: `pnpm test -- src/server/gift src/app/api/gift/packets && pnpm typecheck`

Expected: all server and route tests pass; TypeScript exits 0.

```bash
git add src/server/gift src/app/api/gift/packets
git commit -m "feat: add verified gift packet API"
```

---

### Task 3: Address-scoped client outbox and legacy migration

**Files:**
- Create: `src/features/my-packets/types.ts`
- Create: `src/features/my-packets/client.ts`
- Create: `src/features/my-packets/outbox.ts`
- Create: `src/features/my-packets/outbox.test.ts`
- Create: `src/features/my-packets/legacy.ts`
- Create: `src/features/my-packets/legacy.test.ts`

**Interfaces:**
- Produces `fetchMyPackets(creator)`, `persistPacket({ packetId, txHash })`.
- Produces `enqueuePacket(address, packet)`, `flushOutbox(address, persist)`, and `migrateLegacyPackets(address, persist)`.

- [ ] **Step 1: Write failing outbox and legacy tests**

Use jsdom LocalStorage. Assert:

```ts
it("isolates pending packets by normalized wallet address", () => {
  enqueuePacket(addressA, pendingA);
  enqueuePacket(addressB, pendingB);
  expect(readOutbox(addressA)).toEqual([pendingA]);
  expect(readOutbox(addressB)).toEqual([pendingB]);
});

it("removes only successfully persisted entries", async () => {
  const persist = vi.fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("offline"));
  await flushOutbox(addressA, persist);
  expect(readOutbox(addressA)).toEqual([secondPacket]);
});

it("migrates only legacy entries with a bytes32 id and transaction hash", async () => {
  localStorage.setItem("injgift.myPackets", JSON.stringify(validAndInvalidLegacy));
  await migrateLegacyPackets(addressA, persist);
  expect(persist).toHaveBeenCalledWith({ packetId, txHash });
  expect(persist).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test -- src/features/my-packets`

Expected: FAIL because client persistence modules do not exist.

- [ ] **Step 3: Implement the client modules**

Use keys `injgift.packetOutbox:<lowercase-address>` and `injgift.legacyMigration:<lowercase-address>`. Deduplicate pending records by `(packetId, txHash)`. Keep failed entries. Set the migration marker only after every eligible legacy entry returns success or a stable 422 validation response; do not mark migration complete after network/503 failures.

`client.ts` must throw a typed `GiftPacketApiError` carrying HTTP status and stable server code, and must never accept a creator argument for POST.

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm test -- src/features/my-packets && pnpm typecheck`

Expected: client persistence tests pass and TypeScript exits 0.

```bash
git add src/features/my-packets
git commit -m "feat: add wallet-scoped gift sync outbox"
```

---

### Task 4: Shared wallet-aware packet hook

**Files:**
- Create: `src/features/my-packets/useMyPackets.ts`
- Create: `src/features/my-packets/useMyPackets.test.ts`

**Interfaces:**
- Produces `useMyPackets(): { packets, status, refresh, recordCreatedPacket }`.
- Consumes wagmi `useAccount`, API client, outbox, and legacy migration modules.

- [ ] **Step 1: Write failing hook tests**

Mock `useAccount` and the client boundary. Verify:

- Address A loads only A records.
- Rerendering with address B immediately clears A records, then loads B records.
- Disconnecting clears the list without issuing `GET ?creator=null`.
- `recordCreatedPacket` tries POST first and enqueues on network/503 failure.
- `refresh` flushes the current address outbox before fetching.
- A late response for address A cannot overwrite address B after a wallet switch.

The race test must use deferred promises and assert the final list contains only B.

- [ ] **Step 2: Run hook tests and verify RED**

Run: `pnpm test -- src/features/my-packets/useMyPackets.test.ts`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook**

Normalize `useAccount().address`. On every address change, synchronously reset visible packets, start a request generation counter, flush/migrate/fetch for the new address, and ignore results whose generation is stale. Expose `recordCreatedPacket` that requires a connected address and enqueues only retryable failures.

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm test -- src/features/my-packets/useMyPackets.test.ts && pnpm typecheck`

Expected: all wallet-switch, disconnect, retry, and race cases pass.

```bash
git add src/features/my-packets/useMyPackets.ts src/features/my-packets/useMyPackets.test.ts
git commit -m "feat: load gift packets by connected wallet"
```

---

### Task 5: Persist both packet creation flows

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/create/page.tsx`
- Test: `src/features/my-packets/useMyPackets.test.ts`

**Interfaces:**
- Consumes `recordCreatedPacket({ packetId, txHash })`.
- Removes both duplicate `saveMyPacket` LocalStorage implementations.

- [ ] **Step 1: Extend the failing hook test for successful creation UI semantics**

Assert `recordCreatedPacket` resolves after enqueuing a retryable API failure and returns `{ synced: false }`, rather than rejecting the already-confirmed chain operation.

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/features/my-packets/useMyPackets.test.ts`

Expected: FAIL until the result contract is implemented.

- [ ] **Step 3: Update the hook and both create flows**

Return `{ synced: true }` after POST and `{ synced: false }` after queueing. In both creation handlers, after `packetId` and transaction hash exist, call:

```ts
await recordCreatedPacket({
  packetId,
  txHash: txHashValue ?? txHash,
});
```

Do not change the success toast/modal when it queues locally. Remove old `readMyPackets`, `writeMyPackets`, `saveMyPacket`, and duplicated `MyPacket` declarations that are no longer used.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test -- src/features/my-packets && pnpm typecheck`

Expected: persistence tests pass and both pages type-check.

```bash
git add src/app/page.tsx src/app/create/page.tsx src/features/my-packets
git commit -m "feat: persist created gift packet indexes"
```

---

### Task 6: Replace both My Packets views and remove misleading deletion

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/packet/page.tsx`
- Create: `src/features/my-packets/MyPacketList.tsx`
- Create: `src/features/my-packets/MyPacketList.test.ts`
- Modify: `src/i18n/messages.ts`
- Modify: `src/i18n/messages.test.ts`

**Interfaces:**
- Consumes `useMyPackets()` records and `refresh()`.
- Removes local delete and clear-all actions for durable on-chain history.

- [ ] **Step 1: Write failing copy/behavior assertions**

Extend `messages.test.ts` to assert every locale has a disconnected-wallet empty message and synchronization error message. Create `MyPacketList.test.ts` with jsdom and `createElement`, then assert the reusable list offers only copy and view actions:

```ts
render(createElement(MyPacketList, {
  packets: [packet],
  copyLabel: "Copy",
  viewLabel: "View",
  onCopy: vi.fn(),
  onView: vi.fn(),
}));

expect(screen.getByRole("button", { name: "Copy" })).toBeVisible();
expect(screen.getByRole("button", { name: "View" })).toBeVisible();
expect(screen.queryByRole("button", { name: /delete|remove|clear/i })).toBeNull();
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test -- src/i18n/messages.test.ts src/features/my-packets`

Expected: FAIL because the new copy/view behavior is absent.

- [ ] **Step 3: Integrate the shared hook**

Create `MyPacketList.tsx` with props:

```ts
type MyPacketListProps = {
  packets: readonly GiftPacketIndex[];
  limit?: number;
  copyLabel: string;
  viewLabel: string;
  onCopy: (packetId: string) => void;
  onView: (packetId: string) => void;
};
```

It renders packet IDs plus copy and view buttons only. Then use it in the home Mine panel with `limit={3}` and in `/packet` without a limit:

- Render zero records and the disconnected message when there is no address.
- Render the hook's records for the current address only.
- Wire Refresh to `refresh()`.
- Keep copy-link and detail navigation.
- Remove Trash buttons, clear-all buttons, and their handlers/imports.
- Show a non-destructive synchronization warning while cached/outbox retry is pending; do not hide confirmed database records.
- Keep contract-derived details out of PostgreSQL. Where amount/count/mode are not yet fetched from chain, omit those optional labels instead of displaying stale legacy metadata.

- [ ] **Step 4: Verify wallet switching in component tests**

Rerender the hook harness from Task 4 with mocked API results for A, B, and disconnected states. Assert no A packet ID remains after B resolves and no packet ID remains after disconnect. Render `MyPacketList` with the hook's current `packets` to cover the UI boundary.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test && pnpm typecheck && pnpm exec eslint src/app/page.tsx src/app/packet/page.tsx src/features/my-packets src/i18n/messages.ts src/i18n/messages.test.ts`

Expected: all tests pass, TypeScript exits 0, and touched-file lint exits 0.

```bash
git add src/app/page.tsx src/app/packet/page.tsx src/features/my-packets/MyPacketList.tsx src/features/my-packets/MyPacketList.test.ts src/i18n
git commit -m "fix: isolate gift history by wallet"
```

---

### Task 7: Deployment documentation and end-to-end verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-19-gift-packet-persistence.md`

**Interfaces:**
- Documents the server environment and migration/deployment order.

- [ ] **Step 1: Document exact server variables and commands**

Add these non-public variables to `.env.example` and README:

```dotenv
DATABASE_URL=
GIFT_EVM_RPC_URL=https://k8s.testnet.json-rpc.injective.network/
GIFT_EVM_CHAIN_ID=1439
GIFT_EVM_CONTRACT_ADDRESS=0xfF2750Ac6f03d4fD4AA19D49a17DC4459cf2d6Ed
```

Document deployment order:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate:gift
pnpm build
```

State that production values must match the deployed Gift contract/network and that `DATABASE_URL` is shared infrastructure, not a browser variable.

- [ ] **Step 2: Apply migration to a disposable/test database**

Run with an explicitly confirmed non-production URL:

```bash
DATABASE_URL="$GIFT_TEST_DATABASE_URL" pnpm db:migrate:gift
DATABASE_URL="$GIFT_TEST_DATABASE_URL" pnpm db:migrate:gift
```

Expected: first run applies `001-create-gift-packets.sql`; second run reports it already applied. Never run this step against an unconfirmed production database.

- [ ] **Step 3: Run final automated verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm exec eslint \
  src/app/api/gift/packets/route.ts \
  src/app/page.tsx \
  src/app/create/page.tsx \
  src/app/packet/page.tsx \
  src/features/my-packets \
  src/server/gift
pnpm build
```

Expected: tests, type checking, touched-file lint, and production build all exit 0. If the repository-wide lint still reports unrelated pre-existing failures, list them separately and do not expand this task's scope.

- [ ] **Step 4: Perform browser verification**

With a test database and RPC configured:

1. Connect wallet A and create a packet.
2. Confirm one `"gift-packets"` row and that A sees it after reload.
3. Switch to wallet B and confirm A's packet disappears immediately.
4. Switch back to A and confirm the packet returns.
5. Temporarily make the POST endpoint unavailable, create another packet, restore it, refresh, and confirm the outbox synchronizes exactly once.
6. Seed eligible legacy LocalStorage data, connect its actual creator, and confirm verified migration without assigning unrelated records.

- [ ] **Step 5: Record completion and commit**

Mark completed checkboxes only after capturing command outputs and browser evidence.

```bash
git add .env.example README.md docs/superpowers/plans/2026-07-19-gift-packet-persistence.md
git commit -m "docs: add gift persistence deployment guide"
```
