"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WalletButton } from "../../components/WalletButton";
import { ArrowLeft, Search, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { shortenId } from "../../lib/utils";

type MyPacket = {
  id: string;
  createdAt: number;
  amountInj?: string;
  count?: number;
  mode?: string;
  durationDays?: number;
  token?: string;
  txHash?: string | null;
};

const readMyPackets = (): MyPacket[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("injgift.myPackets");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MyPacket[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeMyPackets = (list: MyPacket[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("injgift.myPackets", JSON.stringify(list));
  } catch {
    return;
  }
};

export default function PacketIndexPage() {
  const router = useRouter();
  const [packetId, setPacketId] = useState("");
  const [myPackets, setMyPackets] = useState<MyPacket[]>([]);

  useEffect(() => {
    setMyPackets(readMyPackets());
  }, []);

  const refreshMyPackets = () => setMyPackets(readMyPackets());

  const removePacket = (id: string) => {
    const next = myPackets.filter((p) => p.id !== id);
    setMyPackets(next);
    writeMyPackets(next);
  };

  const clearAll = () => {
    setMyPackets([]);
    writeMyPackets([]);
  };

  const copyClaimLink = async (id: string) => {
    const link = `${window.location.origin}/claim/${id}`;
    await navigator.clipboard.writeText(link);
    toast.success("已复制分享链接");
  };

  const goDetail = () => {
    const id = packetId.trim();
    if (!id) {
      toast.error("请输入红包 ID");
      return;
    }
    router.push(`/packet/${id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" />
        <div
          className="absolute bottom-20 right-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"
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
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Search className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text">我的红包</h1>
                <p className="text-gray-500 text-sm mt-1">输入红包 ID 查看详情</p>
              </div>
            </div>

            {myPackets.length > 0 && (
              <div className="mb-8 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700">我创建的红包</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={refreshMyPackets}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      刷新
                    </button>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {myPackets.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-gray-100 bg-white/95 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-mono text-gray-800">
                            {shortenId(item.id, 12)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.amountInj ? `${item.amountInj} INJ` : ""}
                            {item.count ? ` · ${item.count} 个` : ""}
                            {item.mode ? ` · ${item.mode === "random" ? "随机" : "均分"}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyClaimLink(item.id)}
                            className="p-2 rounded-xl hover:bg-gray-100"
                            title="复制分享链接"
                          >
                            <Copy className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/packet/${item.id}`)}
                            className="px-3 py-2 rounded-xl bg-yellow-600 text-white text-xs font-semibold hover:bg-yellow-700"
                          >
                            查看
                          </button>
                          <button
                            type="button"
                            onClick={() => removePacket(item.id)}
                            className="p-2 rounded-xl hover:bg-red-50"
                            title="移除"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10 rounded-2xl border border-gray-100 bg-white/95 p-5">
              <div className="text-sm font-semibold text-gray-700">查询红包</div>
              <div className="mt-4 space-y-6">
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    红包 ID
                  </label>
                  <input
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 outline-none transition-all text-lg group-hover:border-gray-300"
                    placeholder="例如：abc123..."
                    value={packetId}
                    onChange={(e) => setPacketId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") goDetail();
                    }}
                  />
                </div>

                <button
                  onClick={goDetail}
                  className="relative overflow-hidden w-full bg-gradient-to-r from-yellow-600 via-amber-500 to-orange-500 text-white font-bold text-lg py-5 rounded-2xl shadow-2xl hover:shadow-3xl transition-all flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95"
                >
                  <span className="absolute inset-0 bg-shimmer pointer-events-none" />
                  查看红包详情
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
