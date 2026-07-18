# Network-Neutral Balance Copy Design

## Goal

Remove obsolete Testnet wording from INJ Gift's insufficient-balance message while preserving automatic localization.

## Design

Keep the existing `errors.insufficientFunds` translation key and update its Chinese, English, Japanese, and Korean values. Each message will describe insufficient INJ for the packet amount and gas without naming a network. Existing `errorMessage()` language selection remains unchanged.

## Verification

Add regression assertions for all four locale dictionaries, run the focused i18n test, then run the full test suite, type checking, scoped lint, and production build.
