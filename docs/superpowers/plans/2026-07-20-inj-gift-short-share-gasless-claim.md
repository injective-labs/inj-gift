# INJ Gift Short Sharing and Gasless Claim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `bytes32` packet IDs while adding eight-character share links, database-backed wallet history, and relayer-paid claims usable from INJ Gift and INJ Pass Chat.

**Architecture:** A new InjGift deployment changes only the signed-claim authorization boundary: the recovered signer becomes the beneficiary while a relayer pays gas. Gift's PostgreSQL index assigns unique Base58 share codes and records the contract version, so short URLs resolve to the full chain identity and old contracts remain readable. UI and Chat share one resolver, share-text formatter, and gasless-claim client.

**Tech Stack:** Solidity 0.8.21, Foundry, EIP-712, Next.js 16, React 19, PostgreSQL, NestJS, ethers 6, Vitest, Jest

## Global Constraints

- Keep the on-chain packet ID type as `bytes32`.
- Never store plaintext packet passcodes.
- Use unique case-sensitive eight-character Base58 share codes.
- Keep full legacy `0x` packet routes functional.
- Never allow the relayer endpoint to accept arbitrary calldata or targets.
- Bind signed claims to claimer, nonce, deadline, chain ID, and verifying contract.
- Do not commit or push any changes in this execution.

---

### Task 1: Relayer-Compatible Signed Claim Contract

**Files:**
- Modify: `../inj_gift/contracts/src/InjGift.sol`
- Modify: `../inj_gift/contracts/test/InjGift.t.sol`

**Interfaces:**
- Produces: `claimNonces(address) -> uint256`
- Produces: `claimWithSig((bytes32 id,bytes32 pwdHash,address claimer,uint256 nonce,uint256 deadline),bytes signature)`
- Preserves: `claim(bytes32,string)`, `refund(bytes32)`, `redPackets(bytes32)`

- [ ] **Step 1: Write failing Foundry tests**

Add tests proving a relayer can submit a permit signed by `claimer`, the claimed asset is paid to `claimer`, and replay/wrong signer/expired permits revert.

- [ ] **Step 2: Run contract tests to verify RED**

Run: `forge test --match-contract InjGiftTest -vv`

Expected: FAIL because `ClaimPermit` has no `claimer` or `nonce`, and the current implementation requires `signer == msg.sender`.

- [ ] **Step 3: Implement the minimal signed-claim change**

Use:

```solidity
bytes32 private constant CLAIM_PERMIT_TYPEHASH = keccak256(
    "ClaimPermit(bytes32 id,bytes32 pwdHash,address claimer,uint256 nonce,uint256 deadline)"
);

struct ClaimPermit {
    bytes32 id;
    bytes32 pwdHash;
    address claimer;
    uint256 nonce;
    uint256 deadline;
}

mapping(address => uint256) public claimNonces;
```

Require recovered signer equals `permit.claimer`, require and increment `claimNonces[permit.claimer]`, then call `_executeClaim(..., permit.claimer)`.

- [ ] **Step 4: Run tests and format**

Run: `forge fmt --check && forge test -vv`

Expected: all contract tests pass.

---

### Task 2: Share-Code Persistence and Query API

**Files:**
- Create: `db/migrations/002-add-gift-share-codes.sql`
- Create: `src/server/gift/shareCode.ts`
- Create: `src/server/gift/shareCode.test.ts`
- Modify: `src/server/gift/packetRepository.ts`
- Modify: `src/server/gift/packetRepository.test.ts`
- Modify: `src/app/api/gift/packets/route.ts`
- Modify: `src/app/api/gift/packets/route.test.ts`
- Create: `src/app/api/gift/packets/[shareCode]/route.ts`
- Create: `src/app/api/gift/packets/[shareCode]/route.test.ts`

**Interfaces:**
- Produces: `GiftPacketRecord.shareCode: string`
- Produces: `createShareCode(randomBytes?): string`
- Produces: `getGiftPacketByShareCode(db, shareCode)`
- Produces: `GET /api/gift/packets?creator=0x...`
- Produces: `GET /api/gift/packets/{shareCode}`

- [ ] **Step 1: Write failing generator, repository, and route tests**

Cover Base58 alphabet/length, normalized creator queries, generated-code persistence, code resolution, invalid code rejection, and missing code `404`.

- [ ] **Step 2: Run targeted tests to verify RED**

Run: `npm test -- --run src/server/gift src/app/api/gift/packets`

Expected: FAIL because share-code generation and GET handlers are absent.

- [ ] **Step 3: Add migration and minimal implementation**

Add `share_code VARCHAR(8)`, backfill existing rows with unique values in the migration runner, make it `NOT NULL`, and add a unique index. POST retries generation on SQL unique violation `23505`.

- [ ] **Step 4: Run targeted tests and typecheck**

Run: `npm test -- --run src/server/gift src/app/api/gift/packets && npm run typecheck`

Expected: all targeted tests pass and TypeScript exits zero.

---

### Task 3: Shared Packet Client, History, and Share Text

**Files:**
- Create: `src/features/my-packets/types.ts`
- Create: `src/features/my-packets/client.ts`
- Create: `src/features/my-packets/client.test.ts`
- Create: `src/features/my-packets/useMyPackets.ts`
- Create: `src/features/my-packets/useMyPackets.test.ts`
- Create: `src/features/share/shareText.ts`
- Create: `src/features/share/shareText.test.ts`
- Modify: `src/client/gift/packetSync.ts`
- Modify: `src/client/gift/packetSync.test.ts`

**Interfaces:**
- Produces: `fetchMyPackets(creator)`
- Produces: `resolvePacketReference(reference)`
- Produces: `useMyPackets(): { packets, status, refresh, recordCreatedPacket }`
- Produces: `formatShareText({ url, passcode, locale })`

- [ ] **Step 1: Write failing client and hook tests**

Cover creator GET, short-code resolution, full-ID passthrough, address switching, disconnect clearing, stale-response suppression, and localized text containing both link and passcode.

- [ ] **Step 2: Run feature tests to verify RED**

Run: `npm test -- --run src/features/my-packets src/features/share`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the shared clients and hook**

Keep local storage only as a retry outbox. Fetch confirmed history from the API and never expose local delete semantics.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- --run src/features/my-packets src/features/share src/client/gift && npm run typecheck`

Expected: all targeted tests pass.

---

### Task 4: Authenticated Gasless Claim Relayer

**Files:**
- Create: `../inj-pass-backend/src/inj-gift/inj-gift.module.ts`
- Create: `../inj-pass-backend/src/inj-gift/inj-gift.controller.ts`
- Create: `../inj-pass-backend/src/inj-gift/inj-gift.controller.spec.ts`
- Create: `../inj-pass-backend/src/inj-gift/inj-gift-relayer.service.ts`
- Create: `../inj-pass-backend/src/inj-gift/inj-gift-relayer.service.spec.ts`
- Modify: `../inj-pass-backend/src/app.module.ts`
- Modify: `../inj-pass-backend/.env.example`

**Interfaces:**
- Produces: authenticated `POST /inj-gift/claims/relay`
- Consumes: `{ contractAddress, packetId, pwdHash, claimer, nonce, deadline, signature }`
- Returns: `{ transactionHash }`

- [ ] **Step 1: Write failing controller and service tests**

Cover bearer-token enforcement, authenticated-wallet binding, contract allowlist, packet state, nonce/deadline checks, gas cap, invalid signature simulation, and successful broadcast.

- [ ] **Step 2: Run targeted backend tests to verify RED**

Run: `npm test -- --runInBand src/inj-gift`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict DTO validation and relayer service**

Construct `claimWithSig` calldata server-side. Use `INJ_GIFT_RELAYER_PRIVATE_KEY`, `INJ_GIFT_CONTRACT_ADDRESSES`, and `INJ_GIFT_RELAYER_MAX_GAS`. Reject arbitrary targets and mismatched authenticated addresses.

- [ ] **Step 4: Run backend tests and build**

Run: `npm test -- --runInBand src/inj-gift && npm run build`

Expected: tests and Nest build pass.

---

### Task 5: Gasless Claim Client and Contract ABI

**Files:**
- Update generated ABI: `src/lib/abi/InjGift.json`
- Create: `src/features/claim/gaslessClaim.ts`
- Create: `src/features/claim/gaslessClaim.test.ts`
- Modify: `src/stacks/evm/contracts/gift.ts`
- Modify: `src/domain/giftAdapter.ts`
- Modify: `src/stacks/evm/adapter.ts`

**Interfaces:**
- Produces: `claimPacketGasless({ id, password }): Promise<TxResult>`
- Consumes: INJ Pass EIP-712 signing and relayer endpoint

- [ ] **Step 1: Write failing typed-data and relayer tests**

Assert the permit contains the resolved full ID, password hash, wallet address, current nonce, deadline, chain, and contract.

- [ ] **Step 2: Run targeted tests to verify RED**

Run: `npm test -- --run src/features/claim src/stacks/evm`

Expected: FAIL because gasless claim is absent.

- [ ] **Step 3: Implement signing and relayer submission**

Use `eth_signTypedData_v4` through the INJ Pass provider. Keep direct claim as a fallback only when explicitly selected or the relayer is unavailable.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- --run src/features/claim src/stacks/evm && npm run typecheck`

Expected: all targeted tests pass.

---

### Task 6: INJ Gift UI Integration

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/create/page.tsx`
- Modify: `src/app/packet/page.tsx`
- Modify: `src/app/claim/[id]/page.tsx`
- Modify: `src/i18n/messages.ts`
- Modify: `src/i18n/messages.test.ts`

**Interfaces:**
- Consumes: `useMyPackets`, `formatShareText`, `resolvePacketReference`, and `claimPacketGasless`

- [ ] **Step 1: Write failing copy and localization tests**

Require every locale to expose `Copy share link`, share success text, wallet-history loading/error copy, and gasless claim states.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- --run src/i18n src/features`

Expected: FAIL for missing copy and behavior.

- [ ] **Step 3: Integrate the shared behavior**

Show shortened IDs, copy full IDs, copy short URL plus passcode, load Mine from the backend, remove delete/clear controls, resolve short routes, and use gasless claim by default.

- [ ] **Step 4: Run Gift verification**

Run: `npm test -- --run && npm run typecheck && npm run lint && npm run build`

Expected: all commands exit zero.

---

### Task 7: INJ Pass Chat Short-Link and Gasless Claim Integration

**Files:**
- Modify: `../inj-pass-frontend/src/services/inj-gift.ts`
- Modify: `../inj-pass-frontend/src/services/mini-app-commands.ts`
- Modify: `../inj-pass-frontend/scripts/test-mini-app-commands.ts`
- Modify: `../inj-pass-frontend/app/components/InjPassChatShell.tsx`

**Interfaces:**
- Accepts: full packet ID, eight-character share code, or share URL
- Produces: create result containing share URL and passcode
- Uses: hidden INJ Gift mini-app runner for gasless claim

- [ ] **Step 1: Add failing command parser cases**

Add create/share, short-code claim/query, and full short-URL claim cases.

- [ ] **Step 2: Run parser tests to verify RED**

Run: `npm run test-mini-app-commands`

Expected: FAIL for short references.

- [ ] **Step 3: Implement parser and result formatting**

Pass `packetReference` to INJ Gift instead of requiring a `bytes32` match in Chat. Keep the mini-app as the execution authority.

- [ ] **Step 4: Run frontend verification**

Run: `npm run test-mini-app-commands && npm run typecheck && npm run build`

Expected: all commands exit zero.

---

### Task 8: Deployment and End-to-End Verification

**Files:**
- Modify: `../inj_gift/contracts/README.md`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `../inj-pass-backend/.env.example`

**Interfaces:**
- Documents contract deployment, migration order, relayer configuration, and rollback.

- [ ] **Step 1: Document exact environment variables and order**

Document the new contract address, legacy addresses, relayer URL/key/allowlist/gas cap, and database migration.

- [ ] **Step 2: Verify no secrets or deployment broadcasts were added**

Run: `git status --short` in all four repositories and inspect every diff.

- [ ] **Step 3: Run final automated verification**

Run contract, Gift, backend, and Chat commands from Tasks 1–7.

- [ ] **Step 4: Record manual deployment prerequisites**

Do not broadcast a deployment or run a production migration without explicit user confirmation. Record the exact commands and required values instead.
