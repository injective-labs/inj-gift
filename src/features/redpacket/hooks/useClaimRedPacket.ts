"use client";
import { useTxAction } from "../../shared/hooks/useTxAction";
import { useInjWallet } from "../../../hooks/useInjWallet";
import { claimPacket } from "../../../lib/contract/redPacket";
import { mapRedPacketError } from "../domain/errors";

interface UseClaimReturn<E = unknown> {
  claim: (password: string) => Promise<string>; // returns txHash
  isLoading: boolean;
  error: E | null;
  reset: () => void;
}

export const useClaimRedPacket = (packetId: string): UseClaimReturn => {
  const { address, isConnected, connect, getSigner } = useInjWallet();
  const { isLoading, error, reset, runTx } = useTxAction();

  const claim = async (password: string) => {
    return runTx<string>(async () => {
      if (!isConnected) await connect();
      if (!address) throw new Error("Wallet not connected");

      const signer = await getSigner();
      if (!signer) throw new Error("No signer");

      try {
        const res = await claimPacket(signer, address, {
          packet_id: packetId,
          password,
        });
        return res.transactionHash ?? "";
      } catch (e) {
        throw mapRedPacketError(e);
      }
    });
  };

  return { claim, isLoading, error, reset };
};






