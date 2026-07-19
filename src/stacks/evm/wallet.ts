import { ethers, BrowserProvider, Signer } from "ethers";
import { appError } from "@/domain/errors";
import { evmChain } from "./config";
import { connectInjpass } from "@/wallet/injpass/provider";

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

  private async ensureProvider(): Promise<BrowserProvider> {
    const { provider } = await connectInjpass();
    this.provider = new ethers.BrowserProvider(provider);
    return this.provider;
  }

  async connect(): Promise<void> {
    const provider = await this.ensureProvider();
    try {
      const accounts = (await provider.send("eth_requestAccounts", [])) as string[];
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
