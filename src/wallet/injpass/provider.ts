"use client";

import { InjPassConnector, type Eip1193Provider } from "@injpass/cli";
import { getEvmConfigOrThrow } from "@/stacks/evm/config";
import {
  getInjpassHostProvider,
  isInjpassMiniAppHost,
} from "@/wallet/injpass/hostProvider";

/**
 * INJ Pass embedded-wallet integration.
 *
 * Instead of an injected browser wallet (MetaMask/OKX), the user's INJ Pass
 * wallet is embedded as a floating iframe widget via `@injpass/cli`. Consumers
 * receive its EIP-1193 provider directly instead of relying on browser-injected
 * wallet globals.
 *
 * Signing/broadcasting happens inside the INJ Pass secure popup — the private
 * key never enters this app.
 */

let connector: InjPassConnector | null = null;
let provider: Eip1193Provider | null = null;
let connectedWalletMeta: { address: string; walletName?: string } | null = null;
let hostSessionUnsubscribe: (() => void) | null = null;
let connectPromise: Promise<{
  provider: Eip1193Provider;
  address: string;
  walletName?: string;
}> | null = null;

/**
 * The live INJ Pass EIP-1193 provider, or undefined before `connectInjpass()`
 * has completed. The wagmi connector and ethers wallet target this getter or
 * the result of `connectInjpass()` directly, so browser extensions cannot
 * shadow the selected wallet.
 */
export function getInjpassEip1193(): Eip1193Provider | undefined {
  return provider ?? getInjpassHostProvider() ?? undefined;
}

function getEmbedUrl(): string {
  const url = process.env.NEXT_PUBLIC_INJPASS_EMBED_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_INJPASS_EMBED_URL is required to use the INJ Pass wallet (e.g. https://<inj-pass>/embed).",
    );
  }
  return url;
}

async function readAddress(p: Eip1193Provider): Promise<string> {
  const accounts = (await p.request({ method: "eth_accounts" })) as string[];
  return accounts?.[0] ?? "";
}

/**
 * Connect to the INJ Pass embedded wallet. Idempotent: concurrent/repeat calls
 * share one connection.
 */
export async function connectInjpass(): Promise<{
  provider: Eip1193Provider;
  address: string;
  walletName?: string;
}> {
  if (provider) {
    return {
      provider,
      address: connectedWalletMeta?.address || await readAddress(provider),
      walletName: connectedWalletMeta?.walletName,
    };
  }
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    if (isInjpassMiniAppHost()) {
      const hostedProvider = getInjpassHostProvider();
      if (!hostedProvider) throw new Error("INJ Pass host bridge is unavailable.");
      const session = await hostedProvider.waitForAuthenticatedSession();
      provider = hostedProvider;
      connectedWalletMeta = {
        address: session.address,
        walletName: session.walletName,
      };
      if (!hostSessionUnsubscribe) {
        hostSessionUnsubscribe = hostedProvider.subscribe((nextSession) => {
          if (nextSession.authenticated && nextSession.address) {
            provider = hostedProvider;
            connectedWalletMeta = {
              address: nextSession.address,
              walletName: nextSession.walletName,
            };
            return;
          }
          provider = null;
          connectedWalletMeta = null;
          connectPromise = null;
        });
      }
      return {
        provider: hostedProvider,
        address: session.address,
        walletName: session.walletName,
      };
    }

    const cfg = getEvmConfigOrThrow();

    connector = new InjPassConnector({
      embedUrl: getEmbedUrl(),
      rpcUrl: cfg.rpcUrl,
      chainId: cfg.chainId,
      mode: "floating",
      autoHide: false, // keep the widget alive — it relays signing requests
    });

    connector.onDisconnect(() => {
      provider = null;
      connector = null;
      connectedWalletMeta = null;
      connectPromise = null;
    });

    const wallet = await connector.connect();
    console.log('[inj-gift injpass] connected, address:', wallet.address);
    const p = connector.getEthereumProvider();
    provider = p;
    connectedWalletMeta = {
      address: wallet.address,
      walletName: wallet.walletName,
    };

    return {
      provider: p,
      address: wallet.address,
      walletName: wallet.walletName,
    };
  })();
  const pendingConnection = connectPromise;

  try {
    return await pendingConnection;
  } catch (e) {
    connectPromise = null;
    connector = null;
    provider = null;
    connectedWalletMeta = null;
    throw e;
  }
}

export function isInjpassConnected(): boolean {
  return provider !== null;
}

export function disconnectInjpass(): void {
  if (isInjpassMiniAppHost()) {
    void getInjpassHostProvider()?.request({ method: "injpass_requestLogout" }).catch(() => undefined);
  }
  connector?.disconnect();
  hostSessionUnsubscribe?.();
  hostSessionUnsubscribe = null;
  provider = null;
  connector = null;
  connectedWalletMeta = null;
  connectPromise = null;
}
