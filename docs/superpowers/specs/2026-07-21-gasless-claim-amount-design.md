# Gasless Claim Amount Design

## Goal

Display the exact amount received by a gasless INJ Gift claim without changing the contract or making the relay API wait for transaction confirmation.

## Data Flow

After the relay returns a transaction hash, the browser uses the configured public EVM RPC to wait for one confirmation. It parses `RedPacketClaimed(bytes32,address,uint256)` from the receipt and accepts an event only when its contract address, packet ID, and claimer all match the claim request.

The gasless result returns `hash`, `receipt`, and `claimAmount`, matching the existing direct-claim result shape consumed by the success modal.

## Failure Behavior

- A confirmed receipt with status `0` is treated as a failed claim.
- A receipt timeout returning `null` preserves the transaction hash and leaves `claimAmount` undefined.
- Unrelated or malformed logs are ignored.
- RPC failures remain visible instead of being reported as successful claims.

## Testing

Use an encoded `RedPacketClaimed` log to prove the gasless flow returns the amount. Cover unrelated events, a missing receipt, and a reverted receipt while preserving existing signing and relay-error tests.
