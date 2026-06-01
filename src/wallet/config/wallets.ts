import type { WalletDescriptor } from "../controller/walletController.types";
import { isWalletConnectConfigured } from "./wagmiConfig";

export const EVM_WALLETS: WalletDescriptor[] = [
  {
    id: "metamask",
    name: "MetaMask",
    hint: "推荐使用",
    recommended: true,
    enabled: true,
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    hint: isWalletConnectConfigured() ? "手机扫码" : "未配置",
    recommended: false,
    enabled: isWalletConnectConfigured(),
  },
  {
    id: "okx",
    name: "OKX Wallet",
    hint: "已安装",
    recommended: false,
    enabled: true,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    hint: "可选",
    recommended: false,
    enabled: true,
  },
];

