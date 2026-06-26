"use client";

import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { injectiveInEvmMainnet, injectiveInEvmTestnet } from "./evmChains";
import { evmEnv } from "@/stacks/evm/config";

// EVM-first, INJ Pass only:
// - INJ Pass installs its EIP-1193 provider on window.ethereum; the generic
//   `injected()` connector then transacts through it.
// - All other wallet connectors (MetaMask / OKX / WalletConnect / Coinbase)
//   were removed on purpose — coexisting injected wallets contend over
//   window.ethereum / EIP-6963 and broke connection on some machines.

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

export const wagmiConfig = createConfig({
  chains: evmChains,
  transports: {
    [injectiveInEvmTestnet.id]: chainTransport(injectiveInEvmTestnet),
    [injectiveInEvmMainnet.id]: chainTransport(injectiveInEvmMainnet),
  },
  connectors: typeof window !== "undefined"
    ? [
        // Generic injected connector — picks up the INJ Pass embedded-wallet
        // provider that connectInjpass() installs on window.ethereum.
        injected(),
      ]
    : [],
  ssr: true,
});
