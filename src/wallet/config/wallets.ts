import type { WalletDescriptor } from "../controller/walletController.types";

const isInjpassConfigured = !!process.env.NEXT_PUBLIC_INJPASS_EMBED_URL;

// INJ Pass is the ONLY supported wallet. Other EVM wallets (MetaMask, OKX,
// WalletConnect, Coinbase) were intentionally removed: the app embeds the INJ
// Pass passkey wallet and installs its EIP-1193 provider on window.ethereum.
// Coexisting injected wallets fight over window.ethereum / EIP-6963 and caused
// "connects on some machines, not others" failures.
export const EVM_WALLETS: WalletDescriptor[] = [
  {
    id: "injpass",
    name: "INJ Pass",
    hintKey: isInjpassConfigured ? "noInstall" : "notConfigured",
    recommended: isInjpassConfigured,
    enabled: isInjpassConfigured,
  },
];
