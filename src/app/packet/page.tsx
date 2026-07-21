"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WalletButton } from "../../components/WalletButton";
import { ArrowLeft, Search, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { shortenId } from "../../lib/utils";
import { useI18n } from "@/i18n";
import { useMyPackets } from "@/features/my-packets/useMyPackets";
import { getPacketPasscode } from "@/client/gift/passcodeStore";
import { formatShareText } from "@/features/share/shareText";

export default function PacketIndexPage() {
  const { t } = useI18n();
  const { packetIndex: tp, form, common, errors } = t;
  const router = useRouter();
  const [packetId, setPacketId] = useState("");
  const { packets: myPackets, refresh: refreshMyPackets, status: myStatus } = useMyPackets();

  const copyClaimLink = async (id: string) => {
    const item = myPackets.find((packet) => packet.packetId === id);
    const passcode = item ? getPacketPasscode(item) : null;
    const link = `${window.location.origin}/claim/${item?.shareCode ?? id}`;
    await navigator.clipboard.writeText(formatShareText({
      url: link,
      passcode: passcode ?? undefined,
    }));
    toast.success(errors.copyShareSuccess);
  };

  const goDetail = () => {
    const id = packetId.trim();
    if (!id) {
      toast.error(errors.enterPacketId);
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
            <span className="font-medium">{common.backHome}</span>
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
                <h1 className="text-3xl font-bold gradient-text">{tp.title}</h1>
                <p className="text-gray-500 text-sm mt-1">{tp.subtitle}</p>
              </div>
            </div>

            {myStatus !== "idle" && (
              <div className="mb-8 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700">{common.myCreatedPackets}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={refreshMyPackets}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      {common.refresh}
                    </button>
                  </div>
                </div>

                {myStatus === "loading" && (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white/95 py-8 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tp.loading}
                  </div>
                )}

                {myStatus === "error" && (
                  <button
                    type="button"
                    onClick={refreshMyPackets}
                    className="w-full rounded-2xl border border-red-100 bg-red-50 py-8 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    {tp.loadError}
                  </button>
                )}

                {myStatus === "ready" && myPackets.length === 0 && (
                  <div className="rounded-2xl border border-gray-100 bg-white/95 py-8 text-center text-sm text-gray-500">
                    {tp.empty}
                  </div>
                )}

                {myPackets.length > 0 && (
                <div className="space-y-3">
                  {myPackets.map((item) => (
                    <div
                      key={item.packetId}
                      className="rounded-2xl border border-gray-100 bg-white/95 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-mono text-gray-800">
                            {item.shareCode ?? shortenId(item.packetId, 12)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(item.createdBlockTimestamp ?? "").toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyClaimLink(item.packetId)}
                            className="p-2 rounded-xl hover:bg-gray-100"
                            title={common.copyShareLink}
                          >
                            <Copy className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/packet/${item.packetId}`)}
                            className="px-3 py-2 rounded-xl bg-yellow-600 text-white text-xs font-semibold hover:bg-yellow-700"
                          >
                            {common.view}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            <div className="mt-10 rounded-2xl border border-gray-100 bg-white/95 p-5">
              <div className="text-sm font-semibold text-gray-700">{tp.queryTitle}</div>
              <div className="mt-4 space-y-6">
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    {form.packetId}
                  </label>
                  <input
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 outline-none transition-all text-lg group-hover:border-gray-300"
                    placeholder={common.packetIdPlaceholder}
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
                  {common.viewPacketDetail}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
