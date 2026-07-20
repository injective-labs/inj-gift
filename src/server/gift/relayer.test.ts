import { Wallet, keccak256, toUtf8Bytes } from "ethers";
import { describe, expect, it } from "vitest";
import {
  claimPermitTypes,
  recoverClaimSigner,
  resolveAllowedGiftContracts,
  resolveRelayGasLimit,
} from "./relayer";

describe("INJ Gift standalone relayer", () => {
  it("recovers the wallet that signed the claim permit", async () => {
    const wallet = Wallet.createRandom();
    const domain = {
      name: "InjGift",
      version: "1",
      chainId: 1776,
      verifyingContract: "0x5373A185ee8017eeDD8bF51C009f5A1F058A8D02",
    };
    const permit = {
      id: `0x${"11".repeat(32)}`,
      pwdHash: keccak256(toUtf8Bytes("lucky")),
      claimer: wallet.address,
      nonce: 0n,
      deadline: 2_000_000_000n,
    };
    const signature = await wallet.signTypedData(domain, claimPermitTypes, permit);

    expect(recoverClaimSigner(domain, permit, signature)).toBe(wallet.address);
  });

  it("normalizes the server-only contract allowlist", () => {
    expect(resolveAllowedGiftContracts({
      INJ_GIFT_CONTRACT_ADDRESSES:
        "0x5373A185ee8017eeDD8bF51C009f5A1F058A8D02",
    })).toEqual(["0x5373A185ee8017eeDD8bF51C009f5A1F058A8D02"]);
  });

  it("caps the final padded gas limit", () => {
    expect(resolveRelayGasLimit(400_000n, 500_000n)).toBe(480_000n);
    expect(() => resolveRelayGasLimit(450_000n, 500_000n)).toThrow(
      "Claim gas estimate exceeds the limit",
    );
  });
});
