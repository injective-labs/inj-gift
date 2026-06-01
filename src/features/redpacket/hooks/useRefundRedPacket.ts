"use client";
import { refundPacket } from "../../../lib/contract/redPacket";
import { useInjWallet } from "../../../hooks/useInjWallet";
import { useTxAction } from "../../shared/hooks/useTxAction";
import { mapRedPacketError } from "../domain/errors";

export const useRefundRedPacket = (packetId: string) => {
  const { isConnected, connect, address, getSigner } = useInjWallet();
  const { isLoading, error, runTx, reset } = useTxAction();

  const refund = async () =>
    runTx(async () => {
      if (!isConnected) await connect();
      if (!address) throw new Error("Wallet not connected");
      const signer = await getSigner();
      if (!signer) throw new Error("No signer");
      try {
        const tx = await refundPacket(signer, address, packetId);
        return tx.transactionHash ?? "";
      } catch (e) {
        throw mapRedPacketError(e);
      }
    });

  return { refund, isLoading, error, reset } as const;
};






