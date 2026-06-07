import type { WalletDescriptor } from "../controller/walletController.types";
import { isWalletConnectConfigured } from "./wagmiConfig";

const isInjpassConfigured = !!process.env.NEXT_PUBLIC_INJPASS_EMBED_URL;

export const EVM_WALLETS: WalletDescriptor[] = [
  {
    id: "injpass",
    name: "INJ Pass",
    hintKey: isInjpassConfigured ? "noInstall" : "notConfigured",
    recommended: isInjpassConfigured,
    enabled: isInjpassConfigured,
  },
  {
    id: "metamask",
    name: "MetaMask",
    hintKey: "recommendedUse",
    recommended: false,
    enabled: true,
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    hintKey: isWalletConnectConfigured() ? "scanQr" : "notConfigured",
    recommended: false,
    enabled: isWalletConnectConfigured(),
  },
  {
    id: "okx",
    name: "OKX Wallet",
    hintKey: "installed",
    recommended: false,
    enabled: true,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    hintKey: "optional",
    recommended: false,
    enabled: true,
  },
];

