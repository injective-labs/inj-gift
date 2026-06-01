"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WalletButton } from "../../../components/WalletButton";
import { toast } from "sonner";
import { Modal } from "../../../components/Modal";
import { shortenId } from "../../../lib/utils";
import { ethers } from "ethers";
import { ArrowLeft, Gift, Key, Loader2, Sparkles, Check, Copy } from "lucide-react";
import { useGiftAdapter } from "../../../hooks/useGiftAdapter";
import { useTx } from "../../../hooks/useTx";
import { isBytes32Hex } from "../../../lib/utils";
import { normalizeError } from "../../../domain/normalizeError";
import type { GiftPacket } from "../../../domain/types";

export default function ClaimPage() {
  const params = useParams<{ id: string }>();
  const packetId = params.id;
  const router = useRouter();
  const isDemo = packetId === "demo";

  const { adapter } = useGiftAdapter();
  const isEvm = adapter.stack === "evm";
  const { run: runTx, state: txState } = useTx();
  const claimLoading = txState.status === "signing" || txState.status === "pending";

  const [password, setPassword] = useState("");
  const [demoClaimed, setDemoClaimed] = useState<null | { amount: string; denom: string }>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [claimAmount, setClaimAmount] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [packet, setPacket] = useState<GiftPacket | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const idError = useMemo(() => {
    if (!isEvm) return null;
    if (isDemo) return null;
    if (!isBytes32Hex(packetId)) {
      return "红包 ID 格式不正确：必须是 0x + 64 位十六进制（bytes32）";
    }
    return null;
  }, [isEvm, isDemo, packetId]);

  useEffect(() => {
    if (isDemo) {
      setPacket({
        id: "demo",
        creator: "inj1demoaddressxxxxxxxxxxxxxxxxxxxxxx",
        token: "0x0000000000000000000000000000000000000000",
        totalAmount: "20000000000000000000",
        totalCount: 8,
        claimedAmount: "5000000000000000000",
        claimedCount: 3,
        expiration: Math.floor(Date.now() / 1000) + 3600,
        mode: "random",
        isActive: true,
      });
      setStatusError(null);
      return;
    }

    if (idError) {
      setPacket(null);
      setStatusError(idError);
      return;
    }

    let mounted = true;
    const load = async () => {
      try {
        setStatusLoading(true);
        const res = await adapter.getPacket(packetId);
        if (!mounted) return;
        setPacket(res);
        setStatusError(null);
      } catch (e: any) {
        if (!mounted) return;
        setPacket(null);
        setStatusError(e?.message || "加载失败");
      } finally {
        if (mounted) setStatusLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [adapter, idError, isDemo, packetId]);

  const summary = useMemo(() => {
    if (!packet) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now > packet.expiration) return { status: "expired" as const };
    if (packet.claimedCount >= packet.totalCount) return { status: "claimed_out" as const };
    if (!packet.isActive) return { status: "inactive" as const };
    return { status: "active" as const };
  }, [packet]);

  const handleClaim = async () => {
    if (!password) {
      toast.error("请输入口令");
      return;
    }
    if (idError) {
      toast.error(idError);
      return;
    }
    if (isDemo) {
      const demoAmounts = ["0.28", "0.36", "0.41", "0.52"];
      const pick = demoAmounts[Math.floor(Math.random() * demoAmounts.length)];
      setDemoClaimed({ amount: pick, denom: "INJ" });
      toast.success("领取成功！🎉");
      return;
    }
    try {
      let amount: string | undefined;
      await runTx(async () => {
        const res = await adapter.claimPacket({ id: packetId, password });
        amount = res.claimAmount;
        return { hash: res.hash };
      });
      toast.success("领取成功！🎉");
      setClaimAmount(amount ?? null);
      setSuccessOpen(true);
    } catch (e: any) {
      const err = normalizeError(e);
      toast.error(err.message || "领取失败");
    }
  };

  const copyClaimLink = async () => {
    const link = `${window.location.origin}/claim/${packetId}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
  };

  const formatClaimAmount = (raw: string | null) => {
    if (!raw) return null;
    try {
      return ethers.formatEther(BigInt(raw));
    } catch {
      return null;
    }
  };

  const formatCount = () => {
    if (!packet) return "";
    return `${packet.totalCount - packet.claimedCount} / ${packet.totalCount}`;
  };

  const errorTitle = idError ? "红包 ID 不合法" : "加载失败";

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 relative overflow-hidden">
      {/* 装饰性背景元素 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-red-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"></div>
        <div className="absolute bottom-20 left-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="container mx-auto px-4 py-6 relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="group flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-all">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">返回首页</span>
          </Link>
          <WalletButton />
        </div>

        {/* Main Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-10 border border-gray-100">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-100">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg animate-float">
                  <Gift className="w-8 h-8 text-white" />
                </div>
                <Sparkles className="w-5 h-5 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text">领取红包</h1>
                <p className="text-gray-500 text-sm mt-1">输入口令，领取惊喜</p>
              </div>
            </div>

            {/* Loading State */}
            {statusLoading && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                <p className="text-gray-600 font-medium">正在加载红包信息...</p>
              </div>
            )}

            {/* ID Error */}
            {statusError && !statusLoading && (
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                <p className="font-semibold text-red-900">{errorTitle}</p>
                <p className="text-sm text-red-700 mt-1">{statusError}</p>
                <button
                  onClick={() => router.push("/claim")}
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-red-600 text-white font-semibold px-5 py-3 hover:bg-red-700 transition-colors"
                >
                  返回重新输入
                </button>
              </div>
            )}

            {/* Red Packet Info */}
            {summary && packet && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-5">
                  <div className="text-xs font-semibold text-orange-700">红包状态</div>
                  <div className="mt-2 text-lg font-bold text-orange-900">
                    {summary.status === "active"
                      ? "进行中"
                      : summary.status === "expired"
                        ? "已过期"
                        : summary.status === "claimed_out"
                          ? "已领完"
                          : "不可用"}
                  </div>
                  <div className="mt-2 text-xs text-orange-800/80">
                    剩余份数: {formatCount()}
                  </div>
                  <div className="mt-1 text-xs text-orange-800/80">
                    过期时间: {new Date(packet.expiration * 1000).toLocaleString()}
                  </div>
                </div>

                {/* Password Input */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Key className="w-4 h-4 text-yellow-500" />
                    输入口令
                  </label>
                  <div className="relative">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="请输入红包口令"
                      className="w-full px-4 py-4 pl-12 border-2 border-gray-200 rounded-xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 outline-none transition-all text-lg group-hover:border-gray-300"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !claimLoading) {
                          handleClaim();
                        }
                      }}
                    />
                    <Key className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Claim Button */}
                <button
                  onClick={handleClaim}
                  disabled={claimLoading || summary.status !== "active"}
                  className="relative overflow-hidden w-full mt-2 bg-gradient-to-r from-orange-600 via-yellow-600 to-orange-600 text-white font-bold text-lg py-5 rounded-2xl shadow-2xl hover:shadow-3xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95"
                >
                  <span className="absolute inset-0 bg-shimmer pointer-events-none" />
                  {claimLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      领取中，请稍候...
                    </>
                  ) : (
                    <>
                      <Gift className="w-6 h-6" />
                      立即领取红包
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </>
                  )}
                </button>

                {isDemo && demoClaimed && (
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-100">
                    <div className="text-sm text-emerald-700 font-semibold">领取结果</div>
                    <div className="text-3xl font-bold text-emerald-900 mt-2">
                      {demoClaimed.amount} {demoClaimed.denom}
                    </div>
                    <button
                      onClick={() => router.push("/packet/demo")}
                      className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white font-semibold px-5 py-3 hover:bg-emerald-700 transition-colors"
                    >
                      查看红包详情
                    </button>
                  </div>
                )}
              </div>
            )}

            {!statusLoading && !summary && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">😢</div>
                <p className="text-gray-600 font-medium">红包不存在或已失效</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={successOpen}
        title="领取成功"
        onClose={() => setSuccessOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
            <div className="text-xs font-semibold text-emerald-700">红包 ID</div>
            <div className="mt-2 text-sm font-mono text-emerald-900">
              {shortenId(packetId, 12)}
            </div>
          </div>

          {claimAmount ? (
            <div className="rounded-2xl bg-white p-4 border border-gray-100">
              <div className="text-xs font-semibold text-gray-600">领取金额</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {formatClaimAmount(claimAmount) ?? claimAmount} INJ
              </div>
              <div className="mt-1 text-xs text-gray-500">原始值: {claimAmount}</div>
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100">
              <div className="text-sm font-semibold text-amber-900">已领取，但未解析到金额</div>
              <div className="mt-1 text-xs text-amber-700">可在详情页查看最新领取记录。</div>
            </div>
          )}

          <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
            <div className="text-xs font-semibold text-gray-600">分享链接</div>
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2">
              <span className="text-xs font-mono text-gray-700 truncate">{`/claim/${packetId}`}</span>
              <button
                type="button"
                onClick={copyClaimLink}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900"
              >
                {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedLink ? "已复制" : "复制链接"}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push(`/packet/${packetId}`)}
              className="flex-1 rounded-xl bg-emerald-600 text-white font-semibold py-3 hover:bg-emerald-700 transition-colors"
            >
              查看红包详情
            </button>
            <button
              type="button"
              onClick={() => setSuccessOpen(false)}
              className="flex-1 rounded-xl bg-gray-100 text-gray-700 font-semibold py-3 hover:bg-gray-200 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}





