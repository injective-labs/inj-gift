import { appError } from "@/domain/errors";
import type { GiftAdapter } from "@/domain/giftAdapter";
import type {
  ClaimPacketInput,
  CreatePacketInput,
  GiftPacket,
  TxResult,
} from "@/domain/types";
import { EvmWallet } from "./wallet";
import {
  InjGiftContractWrapper,
  broadcastCreatePacketSingleShot,
  waitForCreatedPacketId,
} from "./contracts/gift";
import { JsonRpcProvider } from "ethers";
import { getEvmConfigOrThrow, injGiftAddress } from "./config";
import { isInjpassMiniAppHost } from "@/wallet/injpass/hostProvider";
import { connectInjpass } from "@/wallet/injpass/provider";

export class EvmGiftAdapter implements GiftAdapter {
  readonly stack = "evm" as const;

  private wallet = new EvmWallet();
  private contract: InjGiftContractWrapper | null = null;
  private readContract: InjGiftContractWrapper | null = null;

  async connect(): Promise<void> {
    await this.wallet.connect();
    const state = this.wallet.getState();
    if (!state.signer) throw appError("RPC_ERROR", "Signer not available after connect");
    this.contract = new InjGiftContractWrapper(state.signer);
  }

  private async ensureConnected(): Promise<void> {
    if (this.contract) return;
    await this.connect();
  }

  async disconnect(): Promise<void> {
    await this.wallet.disconnect();
    this.contract = null;
  }

  async getAddress(): Promise<string | null> {
    // If the user connected via wagmi UI, this adapter may not have run connect() yet.
    // We keep this side-effect free.
    return this.wallet.getState().address;
  }

  async getPacket(id: string, contractAddress?: string): Promise<GiftPacket> {
    if (contractAddress) {
      return new InjGiftContractWrapper(
        new JsonRpcProvider(getEvmConfigOrThrow().rpcUrl),
        contractAddress,
      ).getPacket(id);
    }
    if (this.contract) return this.contract.getPacket(id);
    if (!this.readContract) {
      this.readContract = new InjGiftContractWrapper(
        new JsonRpcProvider(getEvmConfigOrThrow().rpcUrl),
      );
    }
    return this.readContract.getPacket(id);
  }

  async createPacket(input: CreatePacketInput): Promise<TxResult> {
    // INJ Pass mini-app: broadcast in a single round-trip instead of letting
    // ethers fan out into nonce/estimateGas/feeData calls over the iframe↔host
    // bridge (the classic AI-create hang). packetId is then resolved off the
    // bridge via a public RPC, bounded — so a slow chain never hangs the agent.
    if (isInjpassMiniAppHost()) {
      if (!injGiftAddress) {
        throw appError("INVALID_INPUT", "EVM contract address not configured.");
      }
      const { provider, address } = await connectInjpass();
      const { hash } = await broadcastCreatePacketSingleShot(
        provider,
        address,
        injGiftAddress,
        input,
      );
      const packetId = await waitForCreatedPacketId(hash);
      return { hash, stack: "evm", packetId };
    }
    await this.ensureConnected();
    const { hash, packetId, receipt } = await this.contract!.createPacket(input);
    return { hash, stack: "evm", packetId, receipt };
  }

  async claimPacket(input: ClaimPacketInput, contractAddress?: string): Promise<TxResult> {
    await this.ensureConnected();
    const contract = contractAddress
      ? new InjGiftContractWrapper(this.wallet.getState().signer!, contractAddress)
      : this.contract!;
    const { hash, claimAmount, receipt } = await contract.claimPacket(input);
    return { hash, stack: "evm", claimAmount, receipt };
  }

  async refundPacket(id: string, contractAddress?: string): Promise<TxResult> {
    await this.ensureConnected();
    const contract = contractAddress
      ? new InjGiftContractWrapper(this.wallet.getState().signer!, contractAddress)
      : this.contract!;
    const { hash, receipt } = await contract.refundPacket(id);
    return { hash, stack: "evm", receipt };
  }
}
