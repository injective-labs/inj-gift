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
import { useI18n, errorMessage } from "@/i18n";
import { useMyPackets } from "@/features/my-packets/useMyPackets";
import { formatShareText } from "@/features/share/shareText";
import {
  getPacketPasscode,
  rememberPacketPasscode,
} from "@/client/gift/passcodeStore";

export default function CreatePage() {
  const { t: dict } = useI18n();
  const { create: tc, form, common, errors } = dict;
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
  const [createdShareCode, setCreatedShareCode] = useState<string | null>(null);
  const [createdTxHash, setCreatedTxHash] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedShareCode, setCopiedShareCode] = useState(false);

  const { recordCreatedPacket } = useMyPackets();

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
      toast.error(errors.enterPasscode);
      return;
    }
    if (!Number.isFinite(count) || count <= 0) {
      toast.error(errors.invalidCount);
      return;
    }
    let amountBase = "";
    try {
      amountBase = toBaseUnits(amountInj);
      if (BigInt(amountBase) <= 0n) {
        toast.error(errors.amountPositive);
        return;
      }
    } catch {
      toast.error(errors.invalidAmount);
      return;
    }
    const expiryTs = Date.parse(expiresAt);
    if (!Number.isFinite(expiryTs)) {
      toast.error(errors.invalidExpiry);
      return;
    }
    const durationSec = Math.floor((expiryTs - Date.now()) / 1000);
    if (durationSec <= 0) {
      toast.error(errors.expiryFuture);
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
        if (packetId) {
          const createTxHash = txHashValue ?? txHash;
          const synced = await recordCreatedPacket({ packetId, txHash: createTxHash });
          setCreatedShareCode(synced?.shareCode ?? null);
          rememberPacketPasscode({
            packetId,
            shareCode: synced?.shareCode,
            passcode: password,
          });
        }
        setSuccessOpen(true);
        toast.success(`${errors.createSuccess}: ${txHash.slice(0, 10)}...`);
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, dict) || errors.createFailed);
    }
  };

  const copyPacketId = async () => {
    if (!createdPacketId) return;
    await navigator.clipboard.writeText(createdPacketId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const copyShareCode = async () => {
    if (!createdShareCode) return;
    await navigator.clipboard.writeText(createdShareCode);
    setCopiedShareCode(true);
    setTimeout(() => setCopiedShareCode(false), 1500);
  };

  const copyClaimLink = async () => {
    if (!createdPacketId) return;
    const reference = createdShareCode ?? createdPacketId;
    const passcode = getPacketPasscode({
      packetId: createdPacketId,
      shareCode: createdShareCode ?? undefined,
    }) ?? password;
    const link = `${window.location.origin}/claim/${reference}`;
    await navigator.clipboard.writeText(formatShareText({
      url: link,
      passcode,
    }));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="container mx-auto px-4 py-6 relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="group flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-all">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">{common.backHome}</span>
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
                <h1 className="text-3xl font-bold gradient-text">{tc.title}</h1>
                <p className="text-gray-500 text-sm mt-1">{tc.subtitle}</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Amount */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Coins className="w-4 h-4 text-red-500" />
                  {form.amountInj}
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
                <p className="text-xs text-gray-500 mt-2 ml-1">{tc.amountHint}</p>
              </div>

              {/* Token */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Zap className="w-4 h-4 text-orange-500" />
                  {form.token}
                </label>
                <input
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:ring-4 focus:ring-orange-100 outline-none transition-all group-hover:border-gray-300"
                  placeholder={form.tokenPlaceholder}
                  value={denomOrCw20}
                  onChange={(e) => setDenomOrCw20(e.target.value)}
                />
              </div>

              {/* Count & Expiration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Gift className="w-4 h-4 text-red-500" />
                    {form.count}
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
                    {form.expiry}
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
                  {form.passcodeShort}
                </label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-4 pl-12 border-2 border-gray-200 rounded-xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 outline-none transition-all text-lg group-hover:border-gray-300"
                    placeholder={tc.passcodePlaceholder}
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
                  {form.splitMode}
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
                    <div className="font-bold text-lg mb-1">{form.randomAmount}</div>
                    <div className="text-sm text-gray-600">{tc.randomDesc}</div>
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
                    <div className="font-bold text-lg mb-1">{form.equalSplit}</div>
                    <div className="text-sm text-gray-600">{tc.equalDesc}</div>
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
                    {tc.submitting}
                  </>
                ) : (
                  <>
                    <Gift className="w-6 h-6" />
                    {tc.submit}
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </>
                )}
              </button>

              {/* Tips */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                <div className="flex gap-3">
                  <div className="text-2xl">💡</div>
                  <div className="flex-1 text-sm text-gray-700 space-y-1">
                    <p className="font-semibold text-blue-700">{tc.tipsTitle}</p>
                    <p>{tc.tip1}</p>
                    <p>{tc.tip2}</p>
                    <p>{tc.tip3}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={successOpen}
        title={tc.successTitle}
        onClose={() => setSuccessOpen(false)}
      >
        <div className="space-y-4">
          {createdPacketId ? (
            <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
              {/* Hero: the short share code — the primary thing to hand to others */}
              {createdShareCode ? (
                <div className="rounded-2xl bg-white/90 px-4 py-5 text-center border border-emerald-100">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    {form.shareCode}
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <span className="text-4xl font-extrabold tracking-[0.15em] text-emerald-900">
                      {createdShareCode}
                    </span>
                    <button
                      type="button"
                      onClick={copyShareCode}
                      title={common.copy}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      {copiedShareCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedShareCode ? common.copied : common.copy}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Share link (uses the short code when available) */}
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2">
                <span className="text-xs font-mono text-emerald-900/80 truncate">
                  {`/claim/${createdShareCode ?? shortenId(createdPacketId, 6)}`}
                </span>
                <button
                  type="button"
                  onClick={copyClaimLink}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  {copiedLink ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                  {copiedLink ? common.copied : common.copyShareLink}
                </button>
              </div>

              {/* Full packet id — secondary, for anyone who needs the on-chain id */}
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/50 px-3 py-1.5">
                <span className="text-[11px] font-semibold text-emerald-900/40">{form.packetId}</span>
                <span className="text-[11px] font-mono text-emerald-900/50 truncate">
                  {shortenId(createdPacketId, 6)}
                </span>
                <button
                  type="button"
                  onClick={copyPacketId}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700/70 hover:text-emerald-900"
                >
                  {copiedId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedId ? common.copied : common.copy}
                </button>
              </div>

              <div className="mt-2 text-xs text-emerald-700">
                {tc.shareHint}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100">
              <div className="text-sm font-semibold text-amber-900">{tc.noPacketIdTitle}</div>
              <div className="mt-1 text-xs text-amber-700">{tc.noPacketIdHint}</div>
            </div>
          )}

          {createdTxHash && (
            <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
              <div className="text-xs font-semibold text-gray-600">{common.txHash}</div>
              <div className="mt-2 text-sm font-mono text-gray-900">
                {shortenId(createdTxHash, 10)}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {createdPacketId && (
              <button
                type="button"
                onClick={() => router.push(`/packet/${createdShareCode ?? createdPacketId}`)}
                className="flex-1 rounded-xl bg-emerald-600 text-white font-semibold py-3 hover:bg-emerald-700 transition-colors"
              >
                {common.viewPacketDetail}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSuccessOpen(false)}
              className="flex-1 rounded-xl bg-gray-100 text-gray-700 font-semibold py-3 hover:bg-gray-200 transition-colors"
            >
              {common.close}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
