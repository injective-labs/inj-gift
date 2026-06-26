"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/wallet/config/wagmiConfig";

/**
 * EvmProvider wraps the application with Wagmi and React Query providers.
 * 
 * Future-proofing:
 * - This phase is EVM-first (Injective inEVM).
 * - If CosmWasm support is added later, a separate WasmProvider can be composed
 *   in the root layout alongside this one.
 */
export function EvmProvider({ children }: { children: ReactNode }) {
  // Ensure QueryClient is created only once per lifecycle to avoid hydration issues
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  }));

  return (
    // reconnectOnMount is disabled: with only the generic injected connector,
    // auto-reconnect would silently grab an installed extension (MetaMask/OKX)
    // off window.ethereum on load and masquerade as "connected". INJ Pass is
    // connected explicitly via connectInjpass() instead.
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

