import "@/globals.css";
import { ReactNode } from "react";
import { TxToast } from "../components/TxToast";
import { WalletProvider } from "../providers/WalletProvider";
import { EvmProvider } from "../providers/EvmProvider";
import { I18nProvider } from "@/i18n";
import localFont from "next/font/local";

const bodyFont = localFont({
  src: [
    {
      path: "../../public/fonts/NotoSansSC-400-latin.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/NotoSansSC-500-latin.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/NotoSansSC-600-latin.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/NotoSansSC-700-latin.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-body",
  display: "swap",
});

const displayFont = localFont({
  src: [
    {
      path: "../../public/fonts/ZCOOLKuaiLe-400-latin.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "InjGift · Injective Red Packets",
  description: "A crypto red-packet app built on Injective",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body
        className={`${bodyFont.variable} ${displayFont.variable} min-h-screen antialiased`}
      >
        <I18nProvider>
          <EvmProvider>
            <WalletProvider>
              {children}
              <TxToast />
            </WalletProvider>
          </EvmProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
