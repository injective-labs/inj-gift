"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WalletButton } from "../../components/WalletButton";
import { toast } from "sonner";
import { useGiftAdapter } from "../../hooks/useGiftAdapter";
import { useTx } from "../../hooks/useTx";
import { Modal } from "../../components/Modal";
import { shortenId } from "../../lib/utils";
import { ArrowLeft, Gift, Loader2, Sparkles, Clock, Coins, Key, Zap, Copy, Check, Share2 } from "lucide-react";

export default function CreatePage() {
  const { adapter } = useGiftAdapter();
  const { run: runTx, state: txState } = useTx();
  const router = useRouter();
  const isLoading = txState.status === "signing" || txState.status === "pending";
  const [amountInj, setAmountInj] = useState("0.1");
  const [denomOrCw20, setDenomOrCw20] = useState("INJ");
  const [count, setCount] = useState(2);
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [mode, setMode] = useState<"random" | "equal">("random");
  const [successOpen, setSuccessOpen] = useState(false);
  const [createdPacketId, setCreatedPacketId] = useState<string | null>(null);
  const [createdTxHash, setCreatedTxHash] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const saveMyPacket = (id: string, txHash: string | null) => {
    if (typeof window === "undefined") return;
    try {
      const key = "injgift.myPackets";
      const raw = window.localStorage.getItem(key);
      const list = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      const exists = list.some((item) => item.id === id);
      if (!exists) {
        list.unshift({
          id,
          createdAt: Date.now(),
          amountInj,
          count,
          mode,
          expiresAt,
          token: denomOrCw20.trim(),
          txHash,
        });
        window.localStorage.setItem(key, JSON.stringify(list));
      }
    } catch {
      // Ignore localStorage errors
    }
  };

  const toBaseUnits = (value: string) => {
    const trimmed = value.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("invalid");
    const [whole, frac = ""] = trimmed.split(".");
    const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
    const base =
      BigInt(whole || "0") * 1000000000000000000n +
      BigInt(fracPadded || "0");
    return base.toString();
  };

  const handleCreate = async () => {
    if (!password.trim()) {
      toast.error("请输入口令");
      return;
    }
    if (!Number.isFinite(count) || count <= 0) {
      toast.error("数量不合法");
      return;
    }
    let amountBase = "";
    try {
      amountBase = toBaseUnits(amountInj);
      if (BigInt(amountBase) <= 0n) {
        toast.error("金额必须大于 0");
        return;
      }
    } catch {
      toast.error("金额格式不合法");
      return;
    }
    const expiryTs = Date.parse(expiresAt);
    if (!Number.isFinite(expiryTs)) {
      toast.error("过期时间不合法");
      return;
    }
    const durationSec = Math.floor((expiryTs - Date.now()) / 1000);
    if (durationSec <= 0) {
      toast.error("过期时间必须在未来");
      return;
    }

    try {
      let packetId: string | undefined;
      let txHashValue: string | undefined;
      const txHash = await runTx(async () => {
        // EVM-first: use native token by default
        const token = denomOrCw20.trim().toLowerCase() === "inj"
          ? "0x0000000000000000000000000000000000000000"
          : denomOrCw20.trim();
        const res = await adapter.createPacket({
          token,
          amount: amountBase,
          count,
          password,
          durationSec,
          mode,
        });
        packetId = res.packetId;
        txHashValue = res.hash;
        return { hash: res.hash };
      });
      if (txHash) {
        setCreatedTxHash(txHashValue ?? txHash);
        setCreatedPacketId(packetId ?? null);
        if (packetId) saveMyPacket(packetId, txHashValue ?? txHash);
        setSuccessOpen(true);
        toast.success(`创建成功: ${txHash.slice(0, 10)}...`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    }
  };

  const copyPacketId = async () => {
    if (!createdPacketId) return;
    await navigator.clipboard.writeText(createdPacketId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const copyClaimLink = async () => {
    if (!createdPacketId) return;
    const link = `${window.location.origin}/claim/${createdPacketId}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 relative overflow-hidden">
      {/* 装饰性背景元素 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
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
                <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Gift className="w-8 h-8 text-white" />
                </div>
                <Sparkles className="w-5 h-5 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text">创建红包</h1>
                <p className="text-gray-500 text-sm mt-1">填写信息，分享快乐</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Amount */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Coins className="w-4 h-4 text-red-500" />
                  总金额（INJ）
                </label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-4 pl-12 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:ring-4 focus:ring-red-100 outline-none transition-all text-lg group-hover:border-gray-300"
                    placeholder="0.1"
                    inputMode="decimal"
                    value={amountInj}
                    onChange={(e) => setAmountInj(e.target.value)}
                  />
                  <Coins className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">💡 示例：0.1 INJ</p>
              </div>

              {/* Token */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Zap className="w-4 h-4 text-orange-500" />
                  Token 类型
                </label>
                <input
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:ring-4 focus:ring-orange-100 outline-none transition-all group-hover:border-gray-300"
                  placeholder="INJ 或 CW20 合约地址"
                  value={denomOrCw20}
                  onChange={(e) => setDenomOrCw20(e.target.value)}
                />
              </div>

              {/* Count & Expiration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Gift className="w-4 h-4 text-red-500" />
                    红包数量
                  </label>
                  <input
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:ring-4 focus:ring-red-100 outline-none transition-all group-hover:border-gray-300 text-lg"
                    type="number"
                    min="1"
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value || "1", 10))}
                  />
                </div>
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Clock className="w-4 h-4 text-blue-500" />
                    过期时间
                  </label>
                  <input
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition-all group-hover:border-gray-300 text-lg"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Key className="w-4 h-4 text-yellow-500" />
                  口令
                </label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-4 pl-12 border-2 border-gray-200 rounded-xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 outline-none transition-all text-lg group-hover:border-gray-300"
                    placeholder="设置领取口令（例如：恭喜发财）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Key className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Mode */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  分配模式
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setMode("random")}
                    className={`group p-6 border-2 rounded-2xl transition-all transform hover:scale-105 ${
                      mode === "random"
                        ? "border-red-400 bg-gradient-to-br from-red-50 to-orange-50 shadow-lg"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div className="text-4xl mb-2">🎲</div>
                    <div className="font-bold text-lg mb-1">随机金额</div>
                    <div className="text-sm text-gray-600">拼手气红包</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("equal")}
                    className={`group p-6 border-2 rounded-2xl transition-all transform hover:scale-105 ${
                      mode === "equal"
                        ? "border-red-400 bg-gradient-to-br from-red-50 to-orange-50 shadow-lg"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div className="text-4xl mb-2">⚖️</div>
                    <div className="font-bold text-lg mb-1">均等分配</div>
                    <div className="text-sm text-gray-600">公平红包</div>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleCreate}
                disabled={isLoading}
                className="relative overflow-hidden w-full mt-8 bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 text-white font-bold text-lg py-5 rounded-2xl shadow-2xl hover:shadow-3xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95"
              >
                <span className="absolute inset-0 bg-shimmer pointer-events-none" />
                {isLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    创建中，请稍候...
                  </>
                ) : (
                  <>
                    <Gift className="w-6 h-6" />
                    立即创建红包
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </>
                )}
              </button>

              {/* Tips */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                <div className="flex gap-3">
                  <div className="text-2xl">💡</div>
                  <div className="flex-1 text-sm text-gray-700 space-y-1">
                    <p className="font-semibold text-blue-700">温馨提示</p>
                    <p>• 红包创建后无法撤销，请仔细核对信息</p>
                    <p>• 红包将根据设置的有效期自动过期</p>
                    <p>• 请妥善保管红包口令，分享给好友领取</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={successOpen}
        title="创建成功"
        onClose={() => setSuccessOpen(false)}
      >
        <div className="space-y-4">
          {createdPacketId ? (
            <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
              <div className="text-xs font-semibold text-emerald-700">红包 ID</div>
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2">
                <span className="text-xs font-mono text-emerald-900/80 truncate">
                  {createdPacketId}
                </span>
                <button
                  type="button"
                  onClick={copyPacketId}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  {copiedId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedId ? "已复制" : "复制"}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2">
                <span className="text-xs font-mono text-emerald-900/80 truncate">
                  {`/claim/${createdPacketId}`}
                </span>
                <button
                  type="button"
                  onClick={copyClaimLink}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  {copiedLink ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                  {copiedLink ? "已复制" : "复制链接"}
                </button>
              </div>
              <div className="mt-2 text-xs text-emerald-700">
                分享链接给好友，他们只需要输入口令即可领取。
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100">
              <div className="text-sm font-semibold text-amber-900">已创建，但未解析到红包 ID</div>
              <div className="mt-1 text-xs text-amber-700">请稍后在详情页或区块浏览器查看。</div>
            </div>
          )}

          {createdTxHash && (
            <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
              <div className="text-xs font-semibold text-gray-600">交易哈希</div>
              <div className="mt-2 text-sm font-mono text-gray-900">
                {shortenId(createdTxHash, 10)}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {createdPacketId && (
              <button
                type="button"
                onClick={() => router.push(`/packet/${createdPacketId}`)}
                className="flex-1 rounded-xl bg-emerald-600 text-white font-semibold py-3 hover:bg-emerald-700 transition-colors"
              >
                查看红包详情
              </button>
            )}
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




