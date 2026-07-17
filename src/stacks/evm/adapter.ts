import { appError } from "@/domain/errors";
import type { GiftAdapter } from "@/domain/giftAdapter";
import type {
  ClaimPacketInput,
  CreatePacketInput,
  GiftPacket,
  TxResult,
} from "@/domain/types";
import { EvmWallet } from "./wallet";
import { InjGiftContractWrapper } from "./contracts/gift";
import { JsonRpcProvider } from "ethers";
import { getEvmConfigOrThrow } from "./config";

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

  async getPacket(id: string): Promise<GiftPacket> {
    if (this.contract) return this.contract.getPacket(id);
    if (!this.readContract) {
      this.readContract = new InjGiftContractWrapper(
        new JsonRpcProvider(getEvmConfigOrThrow().rpcUrl),
      );
    }
    return this.readContract.getPacket(id);
  }

  async createPacket(input: CreatePacketInput): Promise<TxResult> {
    await this.ensureConnected();
    const { hash, packetId, receipt } = await this.contract!.createPacket(input);
    return { hash, stack: "evm", packetId, receipt };
  }

  async claimPacket(input: ClaimPacketInput): Promise<TxResult> {
    await this.ensureConnected();
    const { hash, claimAmount, receipt } = await this.contract!.claimPacket(input);
    return { hash, stack: "evm", claimAmount, receipt };
  }

  async refundPacket(id: string): Promise<TxResult> {
    await this.ensureConnected();
    const { hash, receipt } = await this.contract!.refundPacket(id);
    return { hash, stack: "evm", receipt };
  }
}
