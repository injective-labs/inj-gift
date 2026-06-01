"use client";
import { useChain } from "@cosmos-kit/react";
import { toast } from "sonner";

type SigningClient = Awaited<ReturnType<NonNullable<ReturnType<typeof useChain>["getSigningCosmWasmClient"]>>>;

export const useInjWallet = () => {
  const {
    isWalletConnected,
    address,
    connect,
    disconnect,
    getSigningCosmWasmClient,
    wallet,
  } = useChain("injective");

  const safeConnect = async () => {
    try {
      await connect();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Wallet connect failed");
    }
  };

  const safeDisconnect = async () => {
    try {
      await disconnect();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Disconnect failed");
    }
  };

  const getSigner = async (): Promise<SigningClient | undefined> => {
    try {
      return await getSigningCosmWasmClient();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Signer unavailable");
      return undefined;
    }
  };

  return {
    address,
    isConnected: isWalletConnected,
    connect: safeConnect,
    disconnect: safeDisconnect,
    getSigner,
    getWalletStrategy: wallet,
  } as const;
};
