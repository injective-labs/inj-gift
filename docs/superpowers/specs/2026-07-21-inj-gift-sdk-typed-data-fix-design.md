# INJ Gift SDK Typed-Data Fix

## Goal

Restore gasless gift claims by upgrading INJ Gift to the INJ Pass SDK version that preserves EIP-712 typed-data metadata, and show safe relay rejection reasons instead of a generic HTTP 400 message.

## Dependency

Pin `@injpass/cli` to exactly `2.7.0` in `package.json` and regenerate `pnpm-lock.yaml`. INJ Gift uses pnpm through its `packageManager` declaration, so the legacy npm lockfile remains outside this change.

## Error Flow

The relay route returns known `GiftRelayError` failures as:

```json
{
  "error": {
    "code": "RELAY_REJECTED",
    "message": "Claim permit signer is invalid"
  }
}
```

Unknown server failures remain masked as `RELAY_UNAVAILABLE` with status 503.

The gasless claim client reads a valid relay error payload and throws its safe message. Invalid or missing error payloads fall back to `INJ Gift relayer returned <status>`.

## Compatibility

No EIP-712 payload fields, relay request fields, contract calls, or successful response shapes change. The SDK upgrade only preserves the typed-data marker across the INJ Pass authorization boundary.

## Testing

- Verify the relay route safely returns a known relay rejection.
- Verify the client surfaces a relay rejection message.
- Preserve existing successful claim and generic failure behavior.
- Run focused tests, type checking, and the full test suite.
