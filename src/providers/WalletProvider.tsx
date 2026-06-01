"use client";
import { ReactNode } from "react";
import { ChainProvider } from "@cosmos-kit/react";
import { wallets as keplrWallets } from "@cosmos-kit/keplr-extension";
import { env } from "../lib/env";

interface Props { children: ReactNode }

const injectiveChain = {
  chain_name: "injective",
  chain_id: env.NEXT_PUBLIC_CHAIN_ID,
  pretty_name: "Injective",
  status: "live",
  network_type: "cosmos",
  bech32_prefix: "inj",
  apis: {
    rpc: [{ address: env.NEXT_PUBLIC_RPC_ENDPOINT }],
    rest: [{ address: env.NEXT_PUBLIC_LCD_ENDPOINT }],
  },
};

export const WalletProvider = ({ children }: Props) => (
  <ChainProvider
    chains={["injective"]}
    wallets={keplrWallets}
    assetLists={[]}
    throwErrors={false}
  >
    {children}
  </ChainProvider>
);
