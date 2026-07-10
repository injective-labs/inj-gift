import { ethers, BrowserProvider, Signer } from "ethers";
import { appError } from "@/domain/errors";
import { evmChain } from "./config";
import { getInjpassEip1193 } from "@/wallet/injpass/provider";

export type EvmWalletState = {
  address: string | null;
  isConnected: boolean;
  provider: BrowserProvider | null;
  signer: Signer | null;
};

export class EvmWallet {
  private provider: BrowserProvider | null = null;
  private signer: Signer | null = null;
  private address: string | null = null;

  // NOTE: no eager provider capture in the constructor. Construction happens at
  // adapter/page init — BEFORE the user connects INJ Pass — so capturing
  // window.ethereum here would (on machines with a MetaMask/OKX extension) latch
  // onto the extension's provider and sign every tx through it. The provider is
  // resolved lazily at connect/tx time instead, preferring the INJ Pass provider.

  /**
   * Resolve the EIP-1193 provider for signing, preferring the INJ Pass embedded
   * wallet over the global window.ethereum. This is the fix for "红包 tx pops
   * MetaMask": an installed extension owns window.ethereum, but INJ Pass is the
   * wallet the user actually connected — so route transactions through it
   * explicitly instead of whatever grabbed the window.ethereum global.
   */
  private ensureProvider(): BrowserProvider {
    const injpass = getInjpassEip1193();
    const eip1193 = injpass ?? (typeof window !== "undefined" ? window.ethereum : undefined);
    if (!eip1193) {
      throw appError("RPC_ERROR", "INJ Pass wallet not connected");
    }
    // Rebuild each time so we never keep a BrowserProvider bound to a stale
    // provider (e.g. one captured before INJ Pass connected).
    this.provider = new ethers.BrowserProvider(eip1193);
    return this.provider;
  }

  async connect(): Promise<void> {
    const provider = this.ensureProvider();
    // Log which provider we actually resolved (INJ Pass preferred) — the whole
    // point of the fix is that tx no longer falls through to window.ethereum.
    console.log('[inj-gift EvmWallet] connecting, usingInjPass:', !!getInjpassEip1193());
    try {
      const accounts = (await provider.send("eth_requestAccounts", [])) as string[];
      console.log('[inj-gift EvmWallet] accounts:', accounts);
      if (!accounts || accounts.length === 0) {
        throw appError("USER_REJECTED", "No accounts returned");
      }
      this.signer = await provider.getSigner();
      this.address = await this.signer.getAddress();
      await this.ensureCorrectNetwork();
    } catch (e: unknown) {
      if (isUserRejected(e)) {
        throw appError("USER_REJECTED", "User rejected connection");
      }
      throw appError("RPC_ERROR", "Failed to connect wallet", { cause: e });
    }
  }

  async disconnect(): Promise<void> {
    this.signer = null;
    this.address = null;
    // Note: MetaMask does not expose a programmatic disconnect; UI should clear state.
  }

  getState(): EvmWalletState {
    return {
      address: this.address,
      isConnected: !!this.address,
      provider: this.provider,
      signer: this.signer,
    };
  }

  private async ensureCorrectNetwork(): Promise<void> {
    if (!this.provider) return;

    if (!evmChain.chainId) {
      throw appError(
        "INVALID_INPUT",
        "EVM chainId not configured. Set NEXT_PUBLIC_EVM_CHAIN_ID",
      );
    }

    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== evmChain.chainId) {
      try {
        await this.provider.send("wallet_switchEthereumChain", [
          { chainId: `0x${evmChain.chainId.toString(16)}` },
        ]);
      } catch (e: unknown) {
        const anyE = e as any;
        const code = anyE?.code;

        if (isUserRejected(e)) {
          throw appError("USER_REJECTED", "User rejected network switch");
        }

        // Unrecognized chain in wallet
        if (code === 4902) {
          try {
            await this.provider.send("wallet_addEthereumChain", [
              {
                chainId: `0x${evmChain.chainId.toString(16)}`,
                chainName: evmChain.params.chainName,
                nativeCurrency: evmChain.params.nativeCurrency,
                rpcUrls: evmChain.params.rpcUrls,
                blockExplorerUrls: evmChain.params.blockExplorerUrls,
              },
            ]);
            await this.provider.send("wallet_switchEthereumChain", [
              { chainId: `0x${evmChain.chainId.toString(16)}` },
            ]);
            return;
          } catch (addErr: unknown) {
            if (isUserRejected(addErr)) {
              throw appError("USER_REJECTED", "User rejected adding/switching network");
            }
            throw appError(
              "WRONG_NETWORK",
              `Please add/switch to ${evmChain.params.chainName} (chainId ${evmChain.chainId})`,
              { cause: addErr },
            );
          }
        }

        throw appError(
          "WRONG_NETWORK",
          `Please switch to ${evmChain.params.chainName} (chainId ${evmChain.chainId})`,
          { cause: e },
        );
      }
    }
  }
}

function isUserRejected(e: unknown): boolean {
  if (e && typeof e === "object") {
    const anyE = e as Record<string, unknown>;
    return (
      anyE.code === 4001 ||
      (typeof anyE.message === "string" && anyE.message.toLowerCase().includes("user rejected"))
    );
  }
  return false;
}

