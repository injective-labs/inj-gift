# Share Link Fallback Without a Stored Passcode

## Goal

Allow creators to copy and open every persisted gift link, including historical packets whose passcodes are not present in local storage.

## Behavior

- When a stored passcode exists, copy the current directly claimable URL with the passcode in the fragment.
- When no stored passcode exists, copy the plain claim URL without a fragment.
- Treat both outcomes as successful copy operations.
- Apply the same behavior to the home Mine panel and the packet list page.

## Scope

Keep passcode persistence, database records, claim validation, and newly created packet sharing unchanged.

## Testing

Add focused unit coverage for constructing a share URL with and without a passcode, then use that shared behavior from both list entry points.
