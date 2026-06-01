"use client";

import clsx from "clsx";
import { ChevronDown, LogOut, Copy, CheckCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { WalletModal } from "@/wallet/ui/WalletModal";
import { useWalletController } from "@/wallet/hooks/useWalletController";

interface WalletButtonProps {
  className?: string;
  label?: string;
}

export const WalletButton = ({ className, label = "使用 INJ Pass 继续" }: WalletButtonProps) => {
  const { state, actions } = useWalletController();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const shortAddress = useMemo(() => {
    if (!state.address) return "";
    return `${state.address.slice(0, 6)}...${state.address.slice(-4)}`;
  }, [state.address]);

  const isConnected = !!state.address;
  const isBusy = state.status === "connecting" || state.status === "switching_network";

  const copyAddress = () => {
    if (state.address) {
      navigator.clipboard.writeText(state.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <WalletModal state={state} actions={actions} />

      {isConnected ? (
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            title={state.address ?? ""}
            className={clsx(
              "group flex items-center gap-3 rounded-lg border border-amber-900/15 bg-white/90 px-4 py-3 font-semibold text-amber-950 shadow-sm backdrop-blur-sm transition-all hover:border-rose-200 hover:bg-white hover:shadow-lg",
              className,
            )}
          >
            <div className="flex h-8 w-20 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-amber-900/10">
              <Image
                src="/inj-pass-logo.png"
                alt="INJ Pass"
                width={80}
                height={13}
                className="h-4 w-auto"
              />
            </div>
            <span className="max-w-[120px] truncate font-mono text-sm">{shortAddress}</span>
            <ChevronDown
              className={clsx(
                "w-4 h-4 transition-transform",
                showDropdown ? "rotate-180" : "",
              )}
            />
          </button>

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white py-2 shadow-2xl">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">已连接地址</div>
                  <div className="font-mono text-sm text-gray-900 break-all">{state.address}</div>
                  {state.expectedChainName && (
                    <div className="text-xs text-gray-500 mt-2">
                      网络：<span className="font-semibold text-gray-700">{state.expectedChainName}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={copyAddress}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">已复制地址</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">复制地址</span>
                    </>
                  )}
                </button>

                <button
                  onClick={async () => {
                    await actions.disconnect();
                    setShowDropdown(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 transition-colors text-left border-t border-gray-100"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-600 font-medium">断开连接</span>
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => actions.openModal()}
          disabled={isBusy}
          className={clsx(
            "group relative flex items-center gap-2.5 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#3f1fff_0%,#8a16e8_38%,#e91987_72%,#ff6b58_100%)] px-4 py-2 font-bold text-white shadow-xl shadow-fuchsia-900/20 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-fuchsia-900/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
        >
          <div className="absolute inset-0 bg-shimmer" />
          <div className="relative flex items-center">
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>{label}</span>
            )}
            {isBusy && <span className="ml-2.5">连接中...</span>}
          </div>
        </button>
      )}
    </>
  );
};
