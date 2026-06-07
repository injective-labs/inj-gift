"use client";

import { InjPassConnector, type Eip1193Provider } from "@injpass/cli";
import { getEvmConfigOrThrow } from "@/stacks/evm/config";

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
let connectPromise: Promise<{ provider: Eip1193Provider; address: string }> | null = null;

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
 * Connect to the INJ Pass embedded wallet and install its provider on
 * `window.ethereum`. Idempotent: concurrent/repeat calls share one connection.
 */
export async function connectInjpass(): Promise<{ provider: Eip1193Provider; address: string }> {
  if (provider) {
    return { provider, address: await readAddress(provider) };
  }
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
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
      connectPromise = null;
    });

    const wallet = await connector.connect();
    const p = connector.getEthereumProvider();
    provider = p;

    // Install as window.ethereum so EvmWallet + wagmi injected pick it up.
    (window as unknown as { ethereum?: unknown }).ethereum = p;
    window.dispatchEvent(new Event("ethereum#initialized"));

    return { provider: p, address: wallet.address };
  })();

  try {
    return await connectPromise;
  } catch (e) {
    connectPromise = null;
    connector = null;
    provider = null;
    throw e;
  }
}

export function isInjpassConnected(): boolean {
  return provider !== null;
}

export function disconnectInjpass(): void {
  connector?.disconnect();
  provider = null;
  connector = null;
  connectPromise = null;
}
