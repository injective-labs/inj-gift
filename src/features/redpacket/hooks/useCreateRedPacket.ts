"use client";
import { useInjWallet } from "../../../hooks/useInjWallet";
import { useTxAction } from "../../shared/hooks/useTxAction";
import { createPacket, CreatePacketMsg } from "../../../lib/contract/redPacket";
import { buildPasswordHashBase64 } from "../../../lib/password";

export const useCreateRedPacket = () => {
  const { isConnected, connect, address, getSigner } = useInjWallet();
  const { isLoading, error, runTx, reset } = useTxAction();

  const create = async (params: {
    amount: string;
    denomOrCw20: string;
    count: number;
    password: string;
    durationSec: number;
    mode: "random" | "equal";
  }) => {
    return runTx(async () => {
      if (!isConnected) await connect();
      if (!address) throw new Error("Wallet not connected");
      const signer = await getSigner();
      if (!signer) throw new Error("No signer");

      const now = Math.floor(Date.now() / 1000);
      const msg: CreatePacketMsg = {
        total_amount: params.amount,
        denom_or_cw20: params.denomOrCw20,
        count: params.count,
        password_hash: buildPasswordHashBase64(params.password),
        expires_at: now + params.durationSec,
        mode: params.mode,
      };
      // If native INJ, attach funds
      const funds = params.denomOrCw20 === "inj"
        ? [{ denom: "inj", amount: params.amount }]
        : [];

      const tx = await createPacket(signer, address, msg, funds);
      return tx.transactionHash ?? "";
    });
  };

  return { create, isLoading, error, reset } as const;
};
