"use client";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { WalletButton } from "../../../components/WalletButton";
import { useGiftAdapter } from "../../../hooks/useGiftAdapter";
import { isBytes32Hex } from "../../../lib/utils";
import type { GiftPacket } from "../../../domain/types";
import { ethers } from "ethers";
import { 
  ArrowLeft, Gift, Loader2, Sparkles,
  RefreshCw, AlertCircle, Copy, Check
} from "lucide-react";
import { useTx } from "../../../hooks/useTx";
import { toast } from "sonner";
import { normalizeError } from "../../../domain/normalizeError";

export default function PacketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<GiftPacket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const { adapter } = useGiftAdapter();
  const isEvm = adapter.stack === "evm";
  const { run: runRefundTx, state: refundState } = useTx();
  const refundLoading = refundState.status === "signing" || refundState.status === "pending";

  const isDemo = id === "demo";

  const fetchPacket = useCallback(async () => {
    if (isDemo) {
      setData({
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
      return;
    }

    if (isEvm && !isBytes32Hex(id)) {
      setError({ message: "红包 ID 格式不正确：必须是 0x + 64 位十六进制（bytes32）" });
      setData(null);
      return;
    }

    try {
      if (!isLoading) setIsLoading(true);
      const packet = await adapter.getPacket(id);
      setData(packet);
      setError(null);
    } catch (e: any) {
      console.error("Fetch packet failed:", e);
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [id, adapter, isDemo, isLoading, isEvm]);

  useEffect(() => {
    fetchPacket();
    timerRef.current = setInterval(fetchPacket, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchPacket]);

  useEffect(() => {
    let mounted = true;
    const loadAddress = async () => {
      const addr = await adapter.getAddress();
      if (!mounted) return;
      if (addr) {
        setAddress(addr);
        return;
      }

      if (typeof window !== "undefined" && (window as any).ethereum) {
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const accounts = (await provider.send("eth_accounts", [])) as string[];
          if (!mounted) return;
          setAddress(accounts?.[0] ?? null);
          return;
        } catch {
          setAddress(null);
          return;
        }
      }

      setAddress(null);
    };
    loadAddress();
    return () => {
      mounted = false;
    };
  }, [adapter]);

  const [copied, setCopied] = useState(false);

  const demoClaims = useMemo(
    () => [
      { address: "inj1qv2...k2p9", amount: "0.41", denom: "INJ" },
      { address: "inj1h9f...7wz3", amount: "0.36", denom: "INJ" },
      { address: "inj1p2k...9tq8", amount: "0.28", denom: "INJ" },
    ],
    []
  );
  const demoTokenAddress = "inj1demotokenxxxxxxxxxxxxxxxxxxxx";
  const copyToken = async () => {
    await navigator.clipboard.writeText(demoTokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isNativeToken = data?.token?.toLowerCase() === "0x0000000000000000000000000000000000000000";
  const formatInj = (raw: string) => {
    try {
      return ethers.formatEther(BigInt(raw));
    } catch {
      return raw;
    }
  };

  const remainingAmount = useMemo(() => {
    if (!data) return null;
    try {
      const remaining = BigInt(data.totalAmount) - BigInt(data.claimedAmount);
      return remaining > 0n ? remaining : 0n;
    } catch {
      return null;
    }
  }, [data]);

  // Derive status from raw GiftPacket data
  const derivedStatus = useMemo(() => {
    if (isDemo) return "active";
    if (!data) return "inactive";
    const now = Math.floor(Date.now() / 1000);
    const remainingZero = remainingAmount === 0n;

    if (now > data.expiration && remainingZero && data.claimedCount < data.totalCount) {
      return "refunded";
    }
    if (now > data.expiration) return "expired";
    if (data.claimedCount >= data.totalCount) return "claimed_out";
    if (!data.isActive) return "inactive";
    return "active";
  }, [data, isDemo, remainingAmount]);

  const isCreator = useMemo(() => {
    if (!address || !data) return false;
    return address.toLowerCase() === data.creator.toLowerCase();
  }, [address, data]);

  const canRefund = useMemo(() => {
    if (!data || derivedStatus !== "expired") return false;
    if (!isCreator) return false;
    if (remainingAmount === null || remainingAmount === 0n) return false;
    if (!isEvm) return false;
    return true;
  }, [data, derivedStatus, isCreator, remainingAmount, isEvm]);

  const handleRefund = async () => {
    if (!data) return;
    try {
      await runRefundTx(async () => {
        const res = await adapter.refundPacket(data.id);
        return { hash: res.hash };
      });
      toast.success("退款已发起");
      fetchPacket();
    } catch (e: any) {
      const err = normalizeError(e);
      toast.error(err.message || "退款失败");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" />
        <div
          className="absolute bottom-20 right-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex justify-between items-center mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="group flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-all"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">返回</span>
          </button>
          <WalletButton />
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-10 border border-gray-100">
            <div className="flex items-center justify-between gap-3 mb-8 pb-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg animate-float">
                    <Gift className="w-8 h-8 text-white" />
                  </div>
                  <Sparkles className="w-5 h-5 text-orange-400 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold gradient-text">红包详情</h1>
                  <p className="text-gray-500 text-sm mt-1">查看红包状态和领取记录</p>
                </div>
              </div>
              <button
                onClick={() => fetchPacket()}
                className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
                title="刷新"
              >
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
                <p className="text-gray-600 font-medium">正在加载红包信息...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <div>
                    <p className="font-semibold text-red-900">加载失败</p>
                    <p className="text-sm text-red-700">{error.message}</p>
                  </div>
                </div>
              </div>
            )}

            {data && (
              <div className="space-y-6">
                {isDemo ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
                      <div className="text-sm font-semibold text-amber-700">资产</div>
                      <div className="mt-2 text-2xl font-bold text-amber-900">INJ</div>
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2">
                        <span className="text-xs font-mono text-amber-900/80 truncate">
                          {demoTokenAddress}
                        </span>
                        <button
                          onClick={copyToken}
                          className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
                        >
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copied ? "已复制" : "复制币地址"}
                        </button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-white/90 p-5">
                      <div className="text-sm font-semibold text-gray-700 mb-4">领取记录</div>
                      <div className="space-y-3">
                        {demoClaims.map((item, index) => (
                          <div
                            key={`${item.address}-${index}`}
                            className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
                          >
                            <span className="text-sm font-mono text-gray-700">{item.address}</span>
                            <span className="text-sm font-semibold text-amber-900">
                              {item.amount} {item.denom}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-100 bg-white/95 p-5">
                      <div className="text-xs font-semibold text-gray-500">红包状态</div>
                      <div className="mt-2 text-lg font-bold text-gray-900">
                        {derivedStatus === "active"
                          ? "进行中"
                          : derivedStatus === "refunded"
                            ? "已退款"
                          : derivedStatus === "expired"
                            ? "已过期"
                            : derivedStatus === "claimed_out"
                              ? "已领完"
                              : "不可用"}
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        过期时间: {new Date(data.expiration * 1000).toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-white/95 p-5">
                      <div className="text-xs font-semibold text-gray-500">创建者</div>
                      <div className="mt-2 text-sm font-mono text-gray-900 break-all">
                        {data.creator}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-white/95 p-5">
                      <div className="text-xs font-semibold text-gray-500">当前钱包</div>
                      <div className="mt-2 text-sm font-mono text-gray-900 break-all">
                        {address ?? "未连接"}
                      </div>
                      {!address && (
                        <div className="mt-2 text-xs text-amber-700">
                          请先连接钱包，否则无法判断是否显示退款按钮。
                        </div>
                      )}
                      {address && !isCreator && derivedStatus === "expired" && (
                        <div className="mt-2 text-xs text-amber-700">
                          当前地址不是创建者，退款按钮不会显示。
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-white/95 p-5">
                      <div className="text-xs font-semibold text-gray-500">总金额 / 已领取 / 剩余</div>
                      <div className="mt-2 text-sm text-gray-900">
                        {formatInj(data.totalAmount)} / {formatInj(data.claimedAmount)} /{" "}
                        {remainingAmount === null ? "--" : formatInj(remainingAmount.toString())} INJ
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-white/95 p-5">
                      <div className="text-xs font-semibold text-gray-500">红包数量 / 已领取</div>
                      <div className="mt-2 text-sm text-gray-900">
                        {data.totalCount} / {data.claimedCount}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">模式: {data.mode === "random" ? "随机" : "均分"}</div>
                    </div>
                    <div className="md:col-span-2 rounded-2xl border border-gray-100 bg-white/95 p-5">
                      <div className="text-xs font-semibold text-gray-500">资产</div>
                      <div className="mt-2 text-sm font-mono text-gray-900 break-all">
                        {isNativeToken ? "INJ (native)" : data.token}
                      </div>
                    </div>
                  </div>
                )}

                {!isDemo && (
                  <div className="flex flex-wrap gap-2">
                    {derivedStatus === "active" && !isCreator && (
                      <Link
                        href={`/claim/${data.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white font-semibold px-5 py-3 hover:bg-emerald-700 transition-colors"
                      >
                        去领取
                      </Link>
                    )}
                    {canRefund && (
                      <button
                        type="button"
                        onClick={handleRefund}
                        disabled={refundLoading}
                        className="inline-flex items-center justify-center rounded-xl bg-amber-600 text-white font-semibold px-5 py-3 hover:bg-amber-700 transition-colors disabled:opacity-50"
                      >
                        {refundLoading ? "退款中..." : "过期退款"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}





