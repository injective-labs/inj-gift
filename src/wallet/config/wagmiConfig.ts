"use client";

import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import type { EIP1193Provider } from "viem";
import { injectiveInEvmMainnet, injectiveInEvmTestnet } from "./evmChains";
import { evmEnv } from "@/stacks/evm/config";
import { getInjpassEip1193 } from "@/wallet/injpass/provider";

// EVM-first, INJ Pass only:
// - The `injected()` connector targets the INJ Pass EIP-1193 provider directly
//   through getInjpassEip1193().
// - All other wallet connectors (MetaMask / OKX / WalletConnect / Coinbase)
//   are intentionally unsupported.

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
        // Injected connector bound to the INJ Pass provider explicitly. `target`
        // and `target.provider` are evaluated lazily at connect-time, so by the
        // time the user clicks connect, connectInjpass() has already populated
        // getInjpassEip1193(). Returning undefined before that is fine — the
        // connector simply reports "not ready" instead of grabbing an extension.
        injected({
          // Stable target so the connector id is always "injpass". The provider
          // itself is resolved lazily on each getProvider() call: undefined until
          // connectInjpass() populates it, then the live INJ Pass EIP-1193
          // provider, so extensions cannot shadow it.
          target: () => ({
            id: "injpass",
            name: "INJ Pass",
            provider: () =>
              getInjpassEip1193() as unknown as EIP1193Provider | undefined,
          }),
        }),
      ]
    : [],
  ssr: true,
});
