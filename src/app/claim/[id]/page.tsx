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
import { normalizeError } from "../../../domain/normalizeError";
import type { GiftPacket } from "../../../domain/types";
import { useI18n, errorMessage } from "@/i18n";
import { claimPacketReference } from "@/features/claim/gaslessClaim";
import { resolvePacketReference } from "@/features/my-packets/client";
import { formatShareText, parseClaimShareInput } from "@/features/share/shareText";

export default function ClaimPage() {
  const { t: dict } = useI18n();
  const { claimDetail: tc, common, errors, status } = dict;
  const params = useParams<{ id: string }>();
  const packetId = parseClaimShareInput(params.id, "").reference;
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
  const [resolvedPacketId, setResolvedPacketId] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    const sharedPasscode = parseClaimShareInput(
      params.id,
      window.location.hash,
    ).passcode;
    if (sharedPasscode) setPassword(sharedPasscode);
  }, [params.id]);

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

    let mounted = true;
    const load = async () => {
      try {
        setStatusLoading(true);
        const resolved = isEvm
          ? await resolvePacketReference(packetId)
          : { packetId };
        const res = await adapter.getPacket(
          resolved.packetId,
          "contractAddress" in resolved ? resolved.contractAddress : undefined,
        );
        if (!mounted) return;
        setResolvedPacketId(resolved.packetId);
        setPacket(res);
        setStatusError(null);
      } catch (e: unknown) {
        if (!mounted) return;
        setPacket(null);
        setStatusError(errorMessage(e, dict) || errors.loadFailed);
      } finally {
        if (mounted) setStatusLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [adapter, dict, errors.loadFailed, isDemo, isEvm, packetId]);

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
      toast.error(errors.enterPasscode);
      return;
    }
    if (isDemo) {
      const demoAmounts = ["0.28", "0.36", "0.41", "0.52"];
      const pick = demoAmounts[Math.floor(Math.random() * demoAmounts.length)];
      setDemoClaimed({ amount: pick, denom: "INJ" });
      toast.success(`${errors.claimSuccess}🎉`);
      return;
    }
    try {
      let amount: string | undefined;
      await runTx(async () => {
        const res = isEvm
          ? await claimPacketReference({
              reference: packetId,
              password,
              adapter,
            })
          : await adapter.claimPacket({ id: packetId, password });
        amount = res.claimAmount;
        return { hash: res.hash };
      });
      toast.success(`${errors.claimSuccess}🎉`);
      setClaimAmount(amount ?? null);
      setSuccessOpen(true);
    } catch (e: unknown) {
      const err = normalizeError(e);
      toast.error(errorMessage(err, dict) || errors.claimFailed);
    }
  };

  const copyClaimLink = async () => {
    const link = `${window.location.origin}/claim/${packetId}`;
    await navigator.clipboard.writeText(formatShareText({
      url: link,
      passcode: password,
    }));
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

  const errorTitle = errors.loadFailed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-red-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"></div>
        <div className="absolute bottom-20 left-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
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
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg animate-float">
                  <Gift className="w-8 h-8 text-white" />
                </div>
                <Sparkles className="w-5 h-5 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text">{tc.title}</h1>
                <p className="text-gray-500 text-sm mt-1">{tc.subtitle}</p>
              </div>
            </div>

            {/* Loading State */}
            {statusLoading && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                <p className="text-gray-600 font-medium">{common.loadingPacket}</p>
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
                  {common.backReenter}
                </button>
              </div>
            )}

            {/* Red Packet Info */}
            {summary && packet && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-5">
                  <div className="text-xs font-semibold text-orange-700">{tc.statusLabel}</div>
                  <div className="mt-2 text-lg font-bold text-orange-900">
                    {summary.status === "active"
                      ? status.active
                      : summary.status === "expired"
                        ? status.expired
                        : summary.status === "claimed_out"
                          ? status.claimedOut
                          : status.inactive}
                  </div>
                  <div className="mt-2 text-xs text-orange-800/80">
                    {tc.remainingCount}: {formatCount()}
                  </div>
                  <div className="mt-1 text-xs text-orange-800/80">
                    {tc.expiryTime}: {new Date(packet.expiration * 1000).toLocaleString()}
                  </div>
                </div>

                {/* Password Input */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Key className="w-4 h-4 text-yellow-500" />
                    {tc.passcodeLabel}
                  </label>
                  <div className="relative">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={tc.passcodePlaceholder}
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

                {isDemo && demoClaimed && (
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-100">
                    <div className="text-sm text-emerald-700 font-semibold">{tc.demoResult}</div>
                    <div className="text-3xl font-bold text-emerald-900 mt-2">
                      {demoClaimed.amount} {demoClaimed.denom}
                    </div>
                    <button
                      onClick={() => router.push("/packet/demo")}
                      className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white font-semibold px-5 py-3 hover:bg-emerald-700 transition-colors"
                    >
                      {common.viewPacketDetail}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!statusLoading && !summary && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">😢</div>
                <p className="text-gray-600 font-medium">{tc.notFound}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={successOpen}
        title={tc.successTitle}
        onClose={() => setSuccessOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
            <div className="text-xs font-semibold text-emerald-700">{dict.form.packetId}</div>
            <div className="mt-2 text-sm font-mono text-emerald-900">
              {shortenId(resolvedPacketId ?? packetId, 12)}
            </div>
          </div>

          {claimAmount ? (
            <div className="rounded-2xl bg-white p-4 border border-gray-100">
              <div className="text-xs font-semibold text-gray-600">{tc.claimAmountLabel}</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {formatClaimAmount(claimAmount) ?? claimAmount} INJ
              </div>
              <div className="mt-1 text-xs text-gray-500">{tc.rawValue}: {claimAmount}</div>
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100">
              <div className="text-sm font-semibold text-amber-900">{tc.noAmountTitle}</div>
              <div className="mt-1 text-xs text-amber-700">{tc.noAmountHint}</div>
            </div>
          )}

          <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
            <div className="text-xs font-semibold text-gray-600">{tc.shareLink}</div>
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2">
              <span className="text-xs font-mono text-gray-700 truncate">{`/claim/${packetId}`}</span>
              <button
                type="button"
                onClick={copyClaimLink}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900"
              >
                {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedLink ? common.copied : common.copyShareLink}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push(`/packet/${resolvedPacketId ?? packetId}`)}
              className="flex-1 rounded-xl bg-emerald-600 text-white font-semibold py-3 hover:bg-emerald-700 transition-colors"
            >
              {common.viewPacketDetail}
            </button>
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
