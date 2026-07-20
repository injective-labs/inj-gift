# INJ Gift Short Sharing and Gasless Claim Design

## Goal

Keep the existing `bytes32` packet identity while making packets easy to share, query, and claim from the INJ Gift UI and INJ Pass AI Chat. Add durable wallet history and true relayer-paid claims for wallets with no INJ balance.

## Contract Strategy

Deploy a new non-upgradeable InjGift contract version. Keep `bytes32 packetId`, packet storage, creation events, direct `claim`, and refund semantics compatible with the existing contract.

Replace the current ineffective relayer behavior in `claimWithSig`. The signed EIP-712 permit contains:

- `bytes32 id`
- `bytes32 pwdHash`
- `address claimer`
- `uint256 nonce`
- `uint256 deadline`

The contract recovers the signer and requires it to equal `claimer`, not `msg.sender`. Any relayer may submit the permit, but `_executeClaim` always records and pays `claimer`. A per-claimer nonce prevents replay across permits. Existing `hasClaimed[id][claimer]` protection remains.

The old contract remains configured as a legacy read/claim target because locked packets cannot be migrated automatically. New packets use the new contract. Full legacy `0x` links remain supported.

## Short Share Codes

The contract continues to emit and consume the full `bytes32 packetId`. PostgreSQL assigns each verified new packet a unique, case-sensitive, eight-character Base58 `shareCode`.

The database enforces uniqueness. Code generation uses cryptographic randomness and retries on a unique-constraint conflict. The share code is an application locator, not a secret or authorization factor.

The canonical short route is:

```text
/claim/{shareCode}
```

The server resolves the share code to the full packet record, including chain ID and contract address. Full `bytes32` routes remain valid for compatibility and recovery.

## Sharing Behavior

Creation success views show a shortened packet ID and the eight-character share code. Copying the packet ID still copies the full `bytes32` value.

Rename the English action from `Copy claim link` to `Copy share link` in every creation and packet-history surface.

Copying the share action writes localized plain text containing both values:

```text
领取链接：https://gift.injpass.com/claim/3kP9xQ7m
领取口令：lucky
```

The passcode is not placed in the URL query or path, preventing routine leakage through browser history, access logs, analytics, and referrer headers.

## Packet Persistence and Queries

Complete the existing Gift-owned persistence work:

- `POST /api/gift/packets` verifies a creation receipt and stores the packet.
- `GET /api/gift/packets?creator={address}` returns that wallet's packets newest first.
- `GET /api/gift/packets/{shareCode}` resolves a short code.

The Mine panel loads records from the API for the connected wallet. Local storage is only a retry outbox for temporary synchronization failures and a one-time migration source for old records. Confirmed database history cannot be locally deleted.

## Gasless Claim Service

Add an authenticated relayer endpoint in `inj-pass-backend`. The client requests a claim permit only after the INJ Pass wallet session is authenticated.

Flow:

1. Resolve the short code or full ID to chain ID, contract, and packet ID.
2. Read the packet and reject missing, inactive, expired, exhausted, or already-claimed packets.
3. Ask the wallet to sign the EIP-712 claim permit containing the password hash, claimer, nonce, and a short deadline.
4. Submit the permit and signature to the backend.
5. Revalidate the authenticated address, chain, contract allowlist, deadline, nonce, and packet state.
6. Estimate gas and enforce per-wallet, per-IP, and global sponsorship limits.
7. Send `claimWithSig` from the relayer wallet.
8. Return the transaction hash and wait for the receipt in the client.

The backend never accepts an arbitrary target or calldata. It constructs the contract call from validated fields.

Direct `claim` remains available as a fallback for wallets that prefer to pay their own gas.

## AI Chat

INJ Pass Chat continues routing `@INJ Gift` commands through the hidden mini-dApp runner.

The command parser accepts:

- a full `bytes32` packet ID;
- an eight-character share code;
- a full short share URL.

Create responses include the short share URL and passcode. Claim commands resolve the packet and use the same EIP-712 relayer flow as the visible mini-dApp. Query commands remain public reads and require no wallet signature.

## Compatibility and Deployment

Maintain a versioned contract registry containing chain ID, contract address, ABI version, and active creation target.

Deployment order:

1. Test and deploy the new contract.
2. Configure backend relayer keys and sponsorship limits.
3. Apply the share-code database migration.
4. Deploy API and relayer support.
5. Deploy INJ Gift with dual-contract reads and new-contract creation.
6. Deploy INJ Pass Chat parsing and result-copy updates.
7. Switch the active creation contract only after end-to-end verification.

Existing packets remain claimable through the old contract. New short links always resolve to their stored contract version.

## Security

- Keep full packet IDs, passwords, and contract addresses out of analytics.
- Never store plaintext passcodes in PostgreSQL.
- Treat copied share text as user-controlled sensitive content.
- Bind every permit to chain ID and verifying contract through EIP-712.
- Include claimer, nonce, and deadline in every permit.
- Send claimed assets only to the recovered signer.
- Rate-limit sponsorship and cap estimated gas before broadcast.
- Store relayer keys only in backend secrets.
- Preserve reentrancy protection and checks-effects-interactions.

## Testing

- Foundry tests cover direct claim compatibility, relayed claim success, wrong signer, wrong claimer, replay, expiration, wrong password, double claim, and payment to the signer.
- API tests cover share-code uniqueness, resolution, creator filtering, invalid input, contract version selection, and unavailable infrastructure.
- Backend tests cover authentication binding, contract allowlists, nonce/deadline validation, gas caps, rate limits, and relayer failures.
- Frontend tests cover shortened display, full-ID copy, localized share text, short URL resolution, old full-ID compatibility, database-backed Mine records, and wallet switching.
- Chat tests cover create, query, and gasless claim using a short code and a short URL.
- End-to-end verification covers a newly created packet claimed by a zero-INJ wallet.
