import type { WalletDescriptor } from "../controller/walletController.types";

const isInjpassConfigured = !!process.env.NEXT_PUBLIC_INJPASS_EMBED_URL;

// INJ Pass is the ONLY supported wallet. Other EVM wallets (MetaMask, OKX,
// WalletConnect, Coinbase) were intentionally removed: the app embeds the INJ
// Pass passkey wallet and exposes its EIP-1193 provider directly to the app.
export const EVM_WALLETS: WalletDescriptor[] = [
  {
    id: "injpass",
    name: "INJ Pass",
    hintKey: isInjpassConfigured ? "noInstall" : "notConfigured",
    recommended: isInjpassConfigured,
    enabled: isInjpassConfigured,
  },
];
