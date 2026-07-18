# Mine Panel Overflow Fix Design

## Scope

Fix text overlap in the home page's expanded "My Packets" (`mine`) panel without changing its information architecture or data behavior. The statistics, query form, and stored-packet list must remain usable at mobile, tablet, and desktop widths.

## Root Cause

The three-column statistics grid allows its children to keep their intrinsic minimum width. The recent packet ID is an unbroken string rendered at a large font size, so it overflows the second grid cell and covers the third cell's source value. The issue reproduces at 768 px, 1024 px, and desktop widths. It does not reproduce on narrow mobile widths because the statistics become a vertical list.

## Design

- Keep the existing one-column mobile and three-column `md` layout.
- Allow every statistics cell to shrink within its assigned grid track by applying a zero minimum width.
- Constrain each statistics value to its cell and render overflowing single-line content with an ellipsis.
- Retain the current visual hierarchy while using a smaller responsive value size at constrained widths and the existing large size where space permits.
- Preserve the full packet ID in application state and navigation. Truncation is presentation-only.
- Do not change the query form, packet-list actions, local storage format, or wallet behavior.

## Verification

- Add a focused regression test that asserts statistics cells and values include the required shrink and truncation constraints.
- Run the focused test first and confirm it fails before the production change.
- Run the full unit test, lint, and type-check suites after implementation.
- Recheck the populated panel at 390 px, 768 px, 1024 px, and 2048 px viewport widths. Confirm the recent packet ID never crosses into the source cell and that mobile content remains readable.

