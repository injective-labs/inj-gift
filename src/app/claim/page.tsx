"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WalletButton } from "../../components/WalletButton";
import { ArrowLeft, Key, Search } from "lucide-react";
import { toast } from "sonner";
import { isBytes32Hex } from "../../lib/utils";
import { useGiftAdapter } from "../../hooks/useGiftAdapter";

export default function ClaimIndexPage() {
  const router = useRouter();
  const { adapter } = useGiftAdapter();
  const isEvm = adapter.stack === "evm";

  const [packetId, setPacketId] = useState("");

  const goClaim = () => {
    const id = packetId.trim();
    if (!id) {
      toast.error("请输入红包 ID");
      return;
    }
    if (isEvm && !isBytes32Hex(id)) {
      toast.error("红包 ID 格式不正确：必须是 0x + 64 位十六进制（bytes32）");
      return;
    }
    router.push(`/claim/${id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-red-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" />
        <div
          className="absolute bottom-20 left-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex justify-between items-center mb-8">
          <Link
            href="/"
            className="group flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-all"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">返回首页</span>
          </Link>
          <WalletButton />
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-10 border border-gray-100">
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Search className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text">领取红包</h1>
                <p className="text-gray-500 text-sm mt-1">输入红包 ID 前往领取</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Key className="w-4 h-4 text-yellow-500" />
                  红包 ID
                </label>
                <input
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 outline-none transition-all text-lg group-hover:border-gray-300"
                  placeholder={isEvm ? "0x..." : "例如：abc123..."}
                  value={packetId}
                  onChange={(e) => setPacketId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") goClaim();
                  }}
                />
              </div>

              <button
                onClick={goClaim}
                className="relative overflow-hidden w-full bg-gradient-to-r from-orange-600 via-yellow-600 to-orange-600 text-white font-bold text-lg py-5 rounded-2xl shadow-2xl hover:shadow-3xl transition-all flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95"
              >
                <span className="absolute inset-0 bg-shimmer pointer-events-none" />
                前往领取
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
