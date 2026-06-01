"use client";

import { createConfig, http } from "wagmi";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";
import { injectiveInEvmMainnet, injectiveInEvmTestnet } from "./evmChains";
import { evmEnv } from "@/stacks/evm/config";

const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const appIconUrl = process.env.NEXT_PUBLIC_APP_ICON_URL || `${appUrl}/favicon.ico`;

// EVM-first Phase 1:
// - We default to EVM-only connectors.
// - Future multi-backend support (e.g. CosmWasm) should plug in via a separate controller
//   without changing UI components.

export const evmChains = [injectiveInEvmTestnet, injectiveInEvmMainnet] as const;

type Chain = (typeof evmChains)[number];

function chainTransport(chain: Chain) {
  // Prefer NEXT_PUBLIC_EVM_RPC_URL when it matches the selected network; otherwise use chain default.
  // We avoid hardcoding RPC URLs in UI; config only.
  if (evmEnv.NEXT_PUBLIC_EVM_RPC_URL) {
    return http(evmEnv.NEXT_PUBLIC_EVM_RPC_URL);
  }
  return http(chain.rpcUrls.default.http[0]);
}

const getOkxProvider = (window?: Window) => {
  if (typeof window === "undefined") return undefined;
  const anyWindow = window as unknown as Record<string, unknown>;
  const okxWallet = anyWindow.okxwallet ?? anyWindow.okxWallet;
  if (okxWallet) return okxWallet as unknown;

  const ethereum = anyWindow.ethereum as { providers?: Array<Record<string, unknown>>; isOkxWallet?: boolean } | undefined;
  if (ethereum?.providers?.length) {
    return ethereum.providers.find((p) => p.isOkxWallet) as unknown;
  }
  if (ethereum?.isOkxWallet) return ethereum as unknown;

  return undefined;
};

export const wagmiConfig = createConfig({
  chains: evmChains,
  transports: {
    [injectiveInEvmTestnet.id]: chainTransport(injectiveInEvmTestnet),
    [injectiveInEvmMainnet.id]: chainTransport(injectiveInEvmMainnet),
  },
  connectors: typeof window !== "undefined" ? [
    injected({
      target: "metaMask",
    }),
    injected({
      target: {
        id: "okxWallet",
        name: "OKX Wallet",
        // Type assertion needed due to Window type conflict between wagmi and DOM types
        provider: getOkxProvider as any,
      },
    }),
    ...(wcProjectId
      ? [
          walletConnect({
            projectId: wcProjectId,
            showQrModal: true,
            metadata: {
              name: "InjGift",
              description: "Injective inEVM Red Packet",
              url: appUrl,
              icons: [appIconUrl],
            },
          }),
        ]
      : []),
    // Optional (can be enabled later in UI config)
    coinbaseWallet({
      appName: "InjGift",
    }),
  ] : [],
  ssr: true,
});

export const isWalletConnectConfigured = () => !!wcProjectId;

