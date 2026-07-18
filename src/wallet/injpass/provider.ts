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
 * wallet is embedded as a floating iframe widget via `@injpass/cli`. After
 * connecting, we install its EIP-1193 provider on `window.ethereum` so the rest
 * of inj-gift (ethers `BrowserProvider` in `EvmWallet`, the wagmi `injected`
 * connector, the InjGift contract wrapper) transacts through it unchanged.
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
 * has completed. The wagmi `injected()` connector targets THIS getter directly
 * (see `wagmiConfig.ts`) instead of reading `window.ethereum` — so a browser
 * wallet extension (MetaMask/OKX) that owns `window.ethereum` can never shadow
 * us. This was the root cause of "some machines can't connect": on machines with
 * an extension installed, `window.ethereum = p` below silently failed (extensions
 * define it read-only) and wagmi kept talking to the locked extension, hanging
 * the connect forever.
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
 * Best-effort install of the INJ Pass provider onto `window.ethereum`, tolerant
 * of a wallet extension having already claimed it as a read-only property.
 * Never throws: wagmi does not depend on this (it targets getInjpassEip1193()),
 * so a failure here is logged and ignored rather than breaking connect.
 */
function installOnWindow(p: Eip1193Provider): void {
  const w = window as unknown as { ethereum?: unknown };
  try {
    w.ethereum = p;
  } catch {
    // An extension likely defined window.ethereum as non-writable. Retry via
    // defineProperty; if that also fails, give up silently — wagmi still works.
    try {
      Object.defineProperty(w, "ethereum", { value: p, configurable: true, writable: true });
    } catch {
      /* extension owns window.ethereum irrevocably — ignore */
    }
  }

  if ((w.ethereum as { isInjPass?: boolean } | undefined)?.isInjPass) {
    console.log("[inj-gift injpass] provider installed on window.ethereum");
    try {
      window.dispatchEvent(new Event("ethereum#initialized"));
    } catch {
      /* ignore */
    }
  } else {
    console.warn(
      "[inj-gift injpass] window.ethereum is held by another wallet extension; " +
        "wagmi will use the INJ Pass provider directly (getInjpassEip1193).",
    );
  }
}

/**
 * Connect to the INJ Pass embedded wallet and install its provider on
 * `window.ethereum`. Idempotent: concurrent/repeat calls share one connection.
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
      installOnWindow(hostedProvider);
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

    // Best-effort: also expose on window.ethereum for any code that reads it
    // directly (ethers `BrowserProvider`, EIP-6963-unaware libs). This is NOT
    // relied upon for wagmi — the wagmi `injected()` connector targets
    // getInjpassEip1193() explicitly. A wallet extension may define
    // window.ethereum as read-only, so assignment can throw or be ignored; that
    // must never block the connect flow.
    installOnWindow(p);

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
