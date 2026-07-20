# INJ Gift Standalone Relayer Design

## Goal

Make INJ Gift an independently deployable dApp. INJ Pass may provide wallet
connection, SDK, authenticated mini-app session, typed-data signing, and Chat
mini-app dispatch, but it must not host INJ Gift business APIs, Relayer keys,
contract execution, packet persistence, or chain-specific backend logic.

## Ownership

INJ Gift owns:

- `GET/POST /api/gift/packets`
- short-code resolution and wallet history
- `POST /api/gift/claims/relay`
- Relayer private key, contract allowlist, RPC and gas limits
- EIP-712 permit verification and transaction broadcast
- current and legacy contract routing

INJ Pass frontend owns only:

- generic mini-app iframe/session transport
- generic EIP-1193 and `eth_signTypedData_v4` host support
- INJ Gift Chat command parsing and dispatch to the INJ Gift mini-app

INJ Pass backend owns no INJ Gift code or environment variables.

## Claim Flow

1. INJ Gift resolves the packet reference using its own API.
2. The INJ Gift client asks the connected INJ Pass wallet provider to sign an
   EIP-712 `ClaimPermit`.
3. The client posts the permit to same-origin `/api/gift/claims/relay`.
4. The INJ Gift server validates chain, allowlist, signer, nonce, deadline,
   packet state and gas limit.
5. The INJ Gift Relayer wallet broadcasts `claimWithSig`.

No `NEXT_PUBLIC_INJPASS_API_URL` is required.

## Environment

INJ Gift server-only:

- `INJ_GIFT_RELAYER_PRIVATE_KEY`
- `INJ_GIFT_CONTRACT_ADDRESSES`
- `INJ_GIFT_RELAYER_MAX_GAS`
- `GIFT_EVM_CHAIN_ID`
- `GIFT_EVM_RPC_URL`

INJ Gift public wallet/session configuration remains:

- `NEXT_PUBLIC_INJPASS_EMBED_URL`
- existing EVM network and contract variables

## Cleanup

- Remove the `inj-gift` Nest module from `inj-pass-backend`.
- Remove its backend environment variables and module registration.
- Remove direct INJ Gift chain execution from `inj-pass-frontend`; Chat must
  execute through the embedded INJ Gift mini-app.
- Keep generic typed-data signing support because it is wallet-host behavior,
  equivalent to the session bridge used by other mini-apps.

## Security

- Never expose the Relayer private key through a `NEXT_PUBLIC_` variable.
- Never accept arbitrary calldata or arbitrary target contracts.
- Require an allowlisted contract and the configured chain ID.
- Bind permits to packet ID, password hash, claimer, nonce, deadline, chain ID
  and verifying contract.
- Rate-limit before RPC simulation/broadcast and enforce the final padded gas
  limit.

## Verification

- INJ Gift route and Relayer service tests cover authorization and gas caps.
- INJ Gift full test, typecheck and production build pass.
- INJ Pass backend tests/build pass after complete code removal.
- INJ Pass frontend Chat parser, mini-app host tests, typecheck and build pass.

