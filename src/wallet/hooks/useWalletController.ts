"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId } from "wagmi";
import { normalizeError } from "@/domain/normalizeError";
import { appError } from "@/domain/errors";
import { getEvmConfigOrThrow } from "@/stacks/evm/config";
import { connectInjpass, disconnectInjpass, isInjpassConnected } from "@/wallet/injpass/provider";
import type { WalletController, WalletControllerState } from "../controller/walletController.types";

// INJ Pass is the only wallet. Its `injected()` connector targets the INJ Pass
// EIP-1193 provider directly (see wagmiConfig.ts), so once connectInjpass() has
// populated the provider the connector's dynamic id is "injpass".
const walletIdToConnectorId = (id: string) => id;

export function useWalletController(): WalletController {
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [connectedWalletName, setConnectedWalletName] = useState<string | null>(null);
  const [uiStatus, setUiStatus] = useState<WalletControllerState["status"]>("idle");
  const [uiError, setUiError] = useState<WalletControllerState["error"]>(null);

  const evmCfg = useMemo(() => {
    try {
      return getEvmConfigOrThrow();
    } catch {
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

        // Only short-circuit if INJ Pass itself is already the live connection.
        // A stray injected/extension session that wagmi auto-reconnected to must
        // NOT be treated as "connected" — otherwise clicking INJ Pass would skip
        // connectInjpass() and silently leave the user on the wrong wallet.
        if (isInjpassConnected() && accountStatus === "connected" && address) {
          const existingWallet = await connectInjpass();
          setConnectedWalletName(existingWallet.walletName || "INJ Pass Wallet");
          await switchNetwork(true);
          setUiStatus("connected");
          setModalOpen(false);
          return;
        }

        // Spin up the embedded wallet before asking the connector for its
        // explicitly targeted INJ Pass provider.
        if (walletId === "injpass") {
          if (accountStatus === "connected") {
            try {
              await disconnectAsync();
            } catch {
              // ignore — best effort before re-connecting through INJ Pass
            }
          }
          const connectedWallet = await connectInjpass();
          setConnectedWalletName(connectedWallet.walletName || "INJ Pass Wallet");
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
    [accountStatus, address, connectAsync, disconnectAsync, connectors, expectedChainId, switchNetwork, isAlreadyConnectedError],
  );

  const disconnect = useCallback(async () => {
    try {
      await disconnectAsync();
      disconnectInjpass();
      setUiStatus("idle");
      setSelectedWalletId(null);
      setConnectedWalletName(null);
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
    walletName: connectedWalletName,
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
