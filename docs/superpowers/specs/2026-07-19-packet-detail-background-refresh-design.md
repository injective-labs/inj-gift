# Packet Detail Background Refresh Design

## Goal

Stop the packet detail page from repeatedly entering its full-page loading state while preserving automatic five-second updates.

## Design

The page will separate initial loading from background refresh. A large loading indicator appears only when no packet data has been loaded. Polling and manual refresh retain the current packet content; manual refresh may animate the header refresh icon. A request-in-flight ref prevents overlapping RPC calls, and a request sequence prevents stale responses from replacing newer state.

`fetchPacket` will no longer depend on `isLoading`, eliminating the callback/effect identity loop. The polling effect will remain stable for the packet ID and adapter.

## Verification

Extract the refresh-state decision into a small testable helper. Add regression tests proving initial fetch shows blocking loading while polling with existing data does not. Run focused and full tests, type checking, scoped lint, and production build before pushing `inj-gift/main`.
