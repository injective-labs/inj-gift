"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId } from "wagmi";
import { normalizeError } from "@/domain/normalizeError";
import { appError } from "@/domain/errors";
import { getEvmConfigOrThrow } from "@/stacks/evm/config";
import { connectInjpass } from "@/wallet/injpass/provider";
import type { WalletController, WalletControllerState } from "../controller/walletController.types";

const walletIdToConnectorId = (id: string) => {
  switch (id) {
    case "metamask":
      return "metaMask";
    case "okx":
      return "okxWallet";
    case "walletconnect":
      return "walletConnect";
    case "coinbase":
      return "coinbaseWallet";
    case "injpass":
      // INJ Pass installs its EIP-1193 provider on window.ethereum, which the
      // generic injected connector then picks up.
      return "injected";
    default:
      return id;
  }
};

export function useWalletController(): WalletController {
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [uiStatus, setUiStatus] = useState<WalletControllerState["status"]>("idle");
  const [uiError, setUiError] = useState<WalletControllerState["error"]>(null);

  const evmCfg = useMemo(() => {
    try {
      return getEvmConfigOrThrow();
    } catch (e) {
      return null;
    }
  }, []);

  const expectedChainId = evmCfg?.chainId ?? null;
  const expectedChainName = evmCfg?.networkParams?.chainName ?? null;

  const { address, status: accountStatus } = useAccount();
  const chainId = useChainId();

  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const isAlreadyConnectedError = useCallback((e: unknown) => {
    if (!e || typeof e !== "object") return false;
    const anyE = e as Record<string, unknown>;
    const msg = typeof anyE.message === "string" ? anyE.message.toLowerCase() : "";
    return msg.includes("already connected");
  }, []);

  const resetError = useCallback(() => setUiError(null), []);

  const openModal = useCallback(() => {
    setModalOpen(true);
    setUiStatus("idle");
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setUiStatus("idle");
  }, []);

  const selectWallet = useCallback((id: string) => {
    setSelectedWalletId(id);
    setUiError(null);
  }, []);

  const switchNetwork = useCallback(async (force = false) => {
    if (!expectedChainId) {
      const err = appError("INVALID_INPUT", "EVM chainId not configured");
      setUiError(err);
      setUiStatus("error");
      throw err;
    }
    try {
      if (!force && chainId === expectedChainId) {
        setUiStatus("idle");
        return;
      }
      setUiStatus("switching_network");
      await switchChainAsync({ chainId: expectedChainId });
      setUiStatus("idle");
    } catch (e) {
      const err = normalizeError(e);
      setUiError(err);
      setUiStatus("error");
      throw err;
    }
  }, [expectedChainId, switchChainAsync, chainId]);

  const connect = useCallback(
    async (walletId: string) => {
      try {
        setSelectedWalletId(walletId);
        setUiError(null);
        setUiStatus("connecting");

        if (accountStatus === "connected" && address) {
          await switchNetwork(true);
          setUiStatus("connected");
          setModalOpen(false);
          return;
        }

        // INJ Pass: spin up the embedded wallet (iframe + passkey popup) and
        // install its provider on window.ethereum before the injected connector
        // reads it.
        if (walletId === "injpass") {
          await connectInjpass();
        }

        const connectorId = walletIdToConnectorId(walletId);
        const connector = connectors.find((c) => c.id === connectorId);
        if (!connector) {
          const err = appError("NOT_SUPPORTED", `Wallet connector not available: ${walletId}`);
          setUiError(err);
          setUiStatus("error");
          throw err;
        }

        await connectAsync({ connector });

        // After connect, enforce chain (force to ensure prompt if needed)
        if (expectedChainId) {
          await switchNetwork(true);
        }

        setUiStatus("connected");
        setModalOpen(false);
      } catch (e) {
        if (isAlreadyConnectedError(e)) {
          setUiStatus("connected");
          setUiError(null);
          setModalOpen(false);
          return;
        }

        const err = normalizeError(e);
        setUiError(err);
        setUiStatus("error");
        throw err;
      }
    },
    [accountStatus, address, connectAsync, connectors, expectedChainId, chainId, switchNetwork, isAlreadyConnectedError],
  );

  const disconnect = useCallback(async () => {
    try {
      await disconnectAsync();
      setUiStatus("idle");
      setSelectedWalletId(null);
      setUiError(null);
    } catch (e) {
      const err = normalizeError(e);
      setUiError(err);
      setUiStatus("error");
      throw err;
    }
  }, [disconnectAsync]);

  const state: WalletControllerState = {
    backend: "evm",
    status: uiStatus,
    isModalOpen,
    selectedWalletId,
    address: address ?? null,
    chainId: chainId ?? null,
    expectedChainId,
    expectedChainName,
    error: uiError,
  };

  const actions = {
    openModal,
    closeModal,
    selectWallet,
    connect,
    disconnect,
    switchNetwork,
    resetError,
  };

  return { state, actions };
}

