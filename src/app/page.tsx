"use client";

import { WalletButton } from "@/components/WalletButton";
import { MineStats } from "@/components/MineStats";
import {
  ArrowRight,
  ChevronDown,
  Check,
  Clock,
  Coins,
  Copy,
  Gift,
  Key,
  Languages,
  Loader2,
  ReceiptText,
  Search,
  Send,
  Share2,
  WalletCards,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { toast } from "sonner";
import { useGiftAdapter } from "@/hooks/useGiftAdapter";
import { useTx } from "@/hooks/useTx";
import { shortenId } from "@/lib/utils";
import { claimPacketReference } from "@/features/claim/gaslessClaim";
import { useMyPackets } from "@/features/my-packets/useMyPackets";
import { formatShareText } from "@/features/share/shareText";
import {
  useI18n,
  localeNames,
  localeOrder,
  errorMessage,
  type Dict,
} from "@/i18n";

type FeatureType = "create" | "claim" | "mine";
type PacketMode = "random" | "equal";

type FeaturedPacket = {
  mode: PacketMode;
  totalSlots: number;
  claimedSlots: number;
  totalAmount: number;
  denom: "INJ";
  passcode: string;
  claimDurationsMs: number[];
};

const packetPresets: FeaturedPacket[] = [
  {
    mode: "random",
    totalSlots: 8,
    claimedSlots: 3,
    totalAmount: 20,
    denom: "INJ",
    passcode: "ZHUFU2026",
    claimDurationsMs: [2100, 3400, 5200],
  },
  {
    mode: "equal",
    totalSlots: 12,
    claimedSlots: 7,
    totalAmount: 36,
    denom: "INJ",
    passcode: "LUCKYINJ",
    claimDurationsMs: [1400, 2600, 3100, 4300, 5200, 6700, 7100],
  },
  {
    mode: "random",
    totalSlots: 18,
    claimedSlots: 11,
    totalAmount: 88,
    denom: "INJ",
    passcode: "FORTUNE",
    claimDurationsMs: [1800, 2200, 2900, 3300, 4100, 4600, 5700, 6100, 6900, 7200, 8400],
  },
  {
    mode: "random",
    totalSlots: 6,
    claimedSlots: 2,
    totalAmount: 12,
    denom: "INJ",
    passcode: "OPENINJ",
    claimDurationsMs: [1200, 3600],
  },
];

const defaultPacket = packetPresets[0];

const defaultExpiresAt = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

const toBaseUnits = (value: string) => {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("invalid");
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return (
    BigInt(whole || "0") * 1000000000000000000n +
    BigInt(fracPadded || "0")
  ).toString();
};

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createFeaturedPacket(): FeaturedPacket {
  const preset = randomFrom(packetPresets);
  const totalSlots = preset.totalSlots;
  const claimedSlots = Math.max(
    1,
    Math.min(totalSlots - 1, Math.floor(Math.random() * (totalSlots - 2)) + 2),
  );
  const firstClaim = Math.floor(Math.random() * 1700) + 900;
  const claimDurationsMs = Array.from({ length: claimedSlots }, (_, index) =>
    firstClaim + index * (Math.floor(Math.random() * 850) + 520),
  );

  return {
    ...preset,
    claimedSlots,
    claimDurationsMs,
    mode: Math.random() > 0.7 ? "equal" : preset.mode,
    passcode: randomFrom(["ZHUFU2026", "LUCKYINJ", "OPENINJ", "FORTUNE"]),
    totalAmount: randomFrom([12, 20, 36, 66, 88, 128]),
  };
}


function FeatureVisual({
  amountLabel,
  claimCodeLetters,
  claimedPercent,
  labels,
  type,
}: {
  amountLabel: string;
  claimCodeLetters: string[];
  claimedPercent: number;
  labels: Dict["home"]["visual"];
  type: FeatureType;
}) {
  const iconMap = {
    create: Gift,
    claim: Send,
    mine: WalletCards,
  };
  const Icon = iconMap[type];

  return (
    <div className="relative h-44 overflow-hidden rounded-lg border border-amber-900/10 bg-[linear-gradient(135deg,#fff7ed_0%,#ffe4e6_48%,#eef2ff_100%)]">
      <div className="absolute inset-0 lucky-grid opacity-35" />
      {type === "create" && (
        <div className="absolute bottom-5 left-5 right-16">
          <div className="h-28 rounded-lg bg-gradient-to-br from-rose-600 via-red-500 to-orange-500 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between text-xs font-semibold uppercase">
              <span>{labels.seal}</span>
              <span>{amountLabel}</span>
            </div>
            <div className="mt-6 h-3 w-28 rounded-full bg-yellow-200/90" />
            <div className="mt-3 h-3 w-20 rounded-full bg-white/45" />
          </div>
          <div className="absolute -right-5 top-8 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-300 text-amber-900 shadow-lg">
            <Icon className="h-7 w-7" />
          </div>
        </div>
      )}
      {type === "claim" && (
        <div className="absolute inset-x-5 bottom-5">
          <div className="flex items-end gap-3">
            <div className="relative h-24 flex-1 rounded-lg bg-white/85 p-4 shadow-lg">
              <div className="h-3 w-20 rounded-full bg-rose-500" />
              <div className="mt-4 grid grid-cols-4 gap-2">
                {claimCodeLetters.map((letter) => (
                  <span
                    key={letter}
                    className="flex h-9 items-center justify-center rounded-md bg-amber-100 text-sm font-bold text-amber-900"
                  >
                    {letter}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-300 to-orange-400 text-white shadow-lg">
              <Icon className="h-8 w-8" />
            </div>
          </div>
        </div>
      )}
      {type === "mine" && (
        <div className="absolute inset-x-5 bottom-5">
          <div className="rounded-lg bg-white/85 p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <ReceiptText className="h-6 w-6 text-rose-600" />
              <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                {labels.live}
              </span>
            </div>
            {[claimedPercent, Math.max(34, claimedPercent - 18), Math.min(92, claimedPercent + 16)].map((width, index) => (
              <div key={width} className="mt-3 flex items-center gap-3">
                <span className="h-3 w-3 rounded-sm bg-orange-400" />
                <span
                  className="h-3 rounded-full bg-amber-200"
                  style={{ width: `${width}%` }}
                />
                <span className="text-xs font-semibold text-amber-900">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureDetailPanel({
  onBack,
  panelRef,
  type,
}: {
  onBack: () => void;
  panelRef?: Ref<HTMLDivElement>;
  type: FeatureType;
}) {
  const { t: dict } = useI18n();
  const { common, form, errors } = dict;
  const panels = dict.panel;
  const panel = panels[type];
  const router = useRouter();
  const { adapter, adapterError } = useGiftAdapter();
  const { run: runCreateTx, state: createTxState } = useTx();
  const { run: runClaimTx, state: claimTxState } = useTx();
  const [amountInj, setAmountInj] = useState("0.1");
  const [denomOrCw20, setDenomOrCw20] = useState("INJ");
  const [count, setCount] = useState(2);
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiresAt);
  const [mode, setMode] = useState<PacketMode>("random");
  const [createdPacketId, setCreatedPacketId] = useState<string | null>(null);
  const [createdShareCode, setCreatedShareCode] = useState<string | null>(null);
  const [createdTxHash, setCreatedTxHash] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [claimPacketId, setClaimPacketId] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [claimAmount, setClaimAmount] = useState<string | null>(null);
  const [packetIdQuery, setPacketIdQuery] = useState("");
  const {
    packets: myPackets,
    refresh: refreshMyPackets,
    recordCreatedPacket,
  } = useMyPackets();
  const createLoading =
    createTxState.status === "signing" || createTxState.status === "pending";
  const claimLoading =
    claimTxState.status === "signing" || claimTxState.status === "pending";
  const isEvm = adapter.stack === "evm";

  const handleCreate = async () => {
    if (adapterError) {
      toast.error(errorMessage(adapterError, dict));
      return;
    }
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
      const txHash = await runCreateTx(async () => {
        const token =
          denomOrCw20.trim().toLowerCase() === "inj"
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
        return { hash: res.hash, receipt: res.receipt };
      });

      setCreatedTxHash(txHashValue ?? txHash);
      setCreatedPacketId(packetId ?? null);
      if (packetId) {
        const createTxHash = txHashValue ?? txHash;
        const synced = await recordCreatedPacket({
          packetId,
          txHash: createTxHash,
        });
        setCreatedShareCode(synced?.shareCode ?? null);
      }
      toast.success(`${errors.createSuccess}: ${txHash.slice(0, 10)}...`);
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

  const copyClaimLink = async () => {
    if (!createdPacketId) return;
    const reference = createdShareCode ?? createdPacketId;
    await navigator.clipboard.writeText(formatShareText({
      url: `${window.location.origin}/claim/${reference}`,
      passcode: password,
    }));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
    toast.success(errors.copyLinkSuccess);
  };

  const handleClaim = async () => {
    if (adapterError) {
      toast.error(errorMessage(adapterError, dict));
      return;
    }
    const id = claimPacketId.trim();
    if (!id) {
      toast.error(errors.enterPacketId);
      return;
    }
    if (!claimPassword.trim()) {
      toast.error(errors.enterPasscode);
      return;
    }

    try {
      let amount: string | undefined;
      const txHash = await runClaimTx(async () => {
        const res = isEvm
          ? await claimPacketReference({
              reference: id,
              password: claimPassword,
              adapter,
            })
          : await adapter.claimPacket({ id, password: claimPassword });
        amount = res.claimAmount;
        return { hash: res.hash, receipt: res.receipt };
      });
      setClaimTxHash(txHash);
      setClaimAmount(amount ?? null);
      toast.success(`${errors.claimSuccess}: ${txHash.slice(0, 10)}...`);
    } catch (e: unknown) {
      toast.error(errorMessage(e, dict) || errors.claimFailed);
    }
  };

  const copyStoredClaimLink = async (reference: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/claim/${reference}`);
    toast.success(errors.copyLinkSuccess);
  };

  const goPacketDetail = (id = packetIdQuery.trim()) => {
    if (!id) {
      toast.error(errors.enterPacketId);
      return;
    }
    router.push(`/packet/${id}`);
  };

  return (
    <div
      ref={panelRef}
      className="feature-panel min-h-[31rem] border-t border-amber-900/10 bg-[#fffaf1]/95 p-6 backdrop-blur-md lg:border-l lg:border-t-0 lg:p-8"
      data-feature-panel={type}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-rose-700">
            {panel.eyebrow}
          </p>
          <h4 className="mt-2 max-w-xl text-3xl font-bold text-amber-950">
            {panel.title}
          </h4>
          {panel.desc && (
            <p className="mt-3 max-w-2xl leading-7 text-amber-900/70">
              {panel.desc}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label={panels.back}
          onClick={onBack}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-950 text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-rose-700"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
        </button>
      </div>

      {type === "create" && (
        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-bold text-amber-900/70">
                <Coins className="h-4 w-4 text-rose-600" />
                {form.amountInj}
              </span>
              <input
                className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 text-lg font-bold text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                inputMode="decimal"
                placeholder="0.1"
                value={amountInj}
                onChange={(event) => setAmountInj(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-bold text-amber-900/70">
                <Gift className="h-4 w-4 text-rose-600" />
                {form.count}
              </span>
              <input
                className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 text-lg font-bold text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                min={1}
                type="number"
                value={count}
                onChange={(event) =>
                  setCount(Number.parseInt(event.target.value || "1", 10))
                }
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-bold text-amber-900/70">
                <Zap className="h-4 w-4 text-orange-500" />
                {form.token}
              </span>
              <input
                className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                placeholder={form.tokenPlaceholder}
                value={denomOrCw20}
                onChange={(event) => setDenomOrCw20(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-bold text-amber-900/70">
                <Clock className="h-4 w-4 text-orange-500" />
                {form.expiry}
              </span>
              <input
                className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="flex items-center gap-2 text-sm font-bold text-amber-900/70">
              <Key className="h-4 w-4 text-yellow-600" />
              {form.passcode}
            </span>
            <input
              className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 text-lg font-bold text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              placeholder={form.passcodePlaceholder}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <div>
            <p className="text-sm font-bold text-amber-900/70">{form.splitMode}</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(["random", "equal"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={`rounded-lg border px-4 py-3 text-sm font-bold transition ${
                    mode === item
                      ? "border-rose-500 bg-rose-50 text-rose-700"
                      : "border-amber-900/15 bg-white/70 text-amber-950 hover:bg-white"
                  }`}
                >
                  {item === "random" ? form.randomAmount : form.equalSplit}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={createLoading}
              className="inline-flex items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-rose-600 via-orange-500 to-yellow-500 px-7 py-4 font-bold text-white shadow-xl transition hover:-translate-y-0.5"
            >
              {createLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Gift className="h-5 w-5" />
              )}
              {createLoading ? panels.create.submitting : panels.create.submit}
            </button>
          </div>

          {(createdPacketId || createdTxHash) && (
            <div className="rounded-lg border border-emerald-700/15 bg-emerald-50/80 p-4">
              {createdPacketId && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-emerald-800">
                    {form.packetId}
                  </p>
                  <div className="flex items-center gap-2 rounded-md bg-white/80 px-3 py-2">
                    <span className="truncate font-mono text-xs text-emerald-950">
                      {shortenId(createdPacketId, 10)}
                    </span>
                    <button
                      type="button"
                      onClick={copyPacketId}
                      className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-700"
                    >
                      {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedId ? common.copied : common.copy}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyClaimLink}
                      className="inline-flex items-center gap-2 rounded-md bg-white/80 px-3 py-2 text-sm font-bold text-emerald-700"
                    >
                      {copiedLink ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                      {common.copyShareLink}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/packet/${createdPacketId}`)}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
                    >
                      {common.viewDetail}
                    </button>
                  </div>
                </div>
              )}
              {createdTxHash && (
                <p className="mt-3 text-xs font-semibold text-emerald-800">
                  {common.txHash}：{shortenId(createdTxHash, 10)}
                </p>
              )}
            </div>
          )}
        </form>
      )}

      {type === "claim" && (
        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleClaim();
          }}
        >
          <label className="block">
            <span className="flex items-center gap-2 text-sm font-bold text-amber-900/70">
              <Search className="h-4 w-4 text-rose-600" />
              {form.packetId}
            </span>
            <input
              className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 font-mono text-sm text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              placeholder={isEvm ? "0x..." : common.packetIdPlaceholder}
              value={claimPacketId}
              onChange={(event) => setClaimPacketId(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="flex items-center gap-2 text-sm font-bold text-amber-900/70">
              <Key className="h-4 w-4 text-yellow-600" />
              {form.passcode}
            </span>
            <input
              className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 text-lg font-bold text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              placeholder={panels.claim.passcodePlaceholder}
              value={claimPassword}
              onChange={(event) => setClaimPassword(event.target.value)}
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={claimLoading}
              className="inline-flex items-center justify-center gap-3 rounded-lg bg-amber-950 px-7 py-4 font-bold text-white shadow-xl transition hover:-translate-y-0.5"
            >
              {claimLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              {claimLoading ? panels.claim.submitting : panels.claim.submit}
            </button>
          </div>
          {(claimTxHash || claimAmount) && (
            <div className="rounded-lg border border-emerald-700/15 bg-emerald-50/80 p-4 text-sm font-semibold text-emerald-800">
              {claimAmount && (
                <p>
                  {panels.claim.claimAmount}：{claimAmount} {panels.claim.rawUnit}
                </p>
              )}
              {claimTxHash && <p>{common.txHash}：{shortenId(claimTxHash, 10)}</p>}
            </div>
          )}
        </form>
      )}

      {type === "mine" && (
        <div className="mt-8 space-y-6">
          <MineStats
            items={[
              { label: panels.mine.records, value: myPackets.length },
              {
                label: panels.mine.recent,
                value: myPackets[0]
                  ? myPackets[0].shareCode ?? shortenId(myPackets[0].packetId, 6)
                  : "-",
              },
              { label: panels.mine.source, value: "Injective" },
            ]}
          />

          <div className="flex flex-col gap-3 rounded-lg border border-amber-900/10 bg-white/55 p-4 md:flex-row md:items-end">
            <label className="block flex-1">
              <span className="text-sm font-bold text-amber-900/70">
                {panels.mine.queryLabel}
              </span>
              <input
                className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 font-mono text-sm text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                placeholder={panels.mine.queryPlaceholder}
                value={packetIdQuery}
                onChange={(event) => setPacketIdQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") goPacketDetail();
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => goPacketDetail()}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-3 rounded-lg border border-amber-900/20 bg-white/80 px-6 font-bold text-amber-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              <WalletCards className="h-5 w-5 text-rose-600" />
              {common.viewPacketDetail}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-amber-900/70">
                {common.myCreatedPackets}
              </p>
              <button
                type="button"
                onClick={refreshMyPackets}
                className="text-xs font-bold text-rose-700"
              >
                {common.refresh}
              </button>
            </div>
            {myPackets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-900/20 bg-white/45 p-5 text-sm font-semibold text-amber-900/60">
                {panels.mine.empty}
              </div>
            ) : (
              myPackets.slice(0, 3).map((item) => (
                <div
                  key={item.packetId}
                  className="rounded-lg border border-amber-900/10 bg-white/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-bold text-amber-950">
                        {item.shareCode ?? shortenId(item.packetId, 12)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-amber-900/60">
                        {item.createdBlockTimestamp
                          ? new Date(item.createdBlockTimestamp).toLocaleString()
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyStoredClaimLink(item.shareCode ?? item.packetId)}
                        className="rounded-md bg-white px-3 py-2 text-xs font-bold text-amber-950"
                        title={common.copyShareLink}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/packet/${item.packetId}`)}
                        className="rounded-md bg-amber-950 px-3 py-2 text-xs font-bold text-white"
                      >
                        {common.view}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { locale, setLocale, t: dict } = useI18n();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<FeatureType | null>(null);
  const [activePrinciple, setActivePrinciple] = useState<number | null>(null);
  const [featuredPacket, setFeaturedPacket] =
    useState<FeaturedPacket>(defaultPacket);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const featurePanelRef = useRef<HTMLDivElement>(null);
  const t = dict.home;

  useEffect(() => {
    const randomizeTimer = window.setTimeout(
      () => setFeaturedPacket(createFeaturedPacket()),
      0,
    );
    return () => {
      window.clearTimeout(randomizeTimer);
    };
  }, []);

  useEffect(() => {
    if (!languageOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !languageMenuRef.current?.contains(target)
      ) {
        setLanguageOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLanguageOpen(false);
    };

    document.addEventListener("click", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [languageOpen]);

  const packetPreview = useMemo(() => {
    const amountLabel = `${featuredPacket.totalAmount} ${featuredPacket.denom}`;
    const remainingSlots = Math.max(
      featuredPacket.totalSlots - featuredPacket.claimedSlots,
      0,
    );
    const fastestClaimMs = Math.min(...featuredPacket.claimDurationsMs);
    const fastestClaimLabel = `${(fastestClaimMs / 1000).toFixed(1)}s`;
    const claimedPercent = Math.round(
      (featuredPacket.claimedSlots / featuredPacket.totalSlots) * 100,
    );

    return {
      amountLabel,
      claimedPercent,
      claimCodeLetters: featuredPacket.passcode.slice(0, 4).split(""),
      fastestClaimLabel,
      remainingSlots,
      };
  }, [featuredPacket]);

  const activeFeatureData = activeFeature
    ? t.features.find((feature) => feature.type === activeFeature)
    : undefined;
  const activePrincipleData =
    activePrinciple === null ? null : t.promise[activePrinciple];
  const selectFeature = (type: FeatureType) => {
    setActiveFeature(type);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const behavior: ScrollBehavior = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches
          ? "auto"
          : "smooth";
        featurePanelRef.current?.scrollIntoView({
          behavior,
          block: "start",
          inline: "nearest",
        });
      });
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden lucky-bg">
      <div className="absolute inset-0 lucky-grid opacity-45 pointer-events-none" />

      <header className="relative z-50 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-6 lg:px-8">
        <div className="flex items-center">
          <div>
            <h1 className="font-display text-3xl title-gradient">InjGift</h1>
            <p className="text-sm font-medium text-orange-800/75">
              {t.brandLine}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <a
            href="https://t.me/injpass"
            target="_blank"
            rel="noreferrer"
            aria-label="Telegram injpass"
            title="Telegram"
            className="group grid h-11 w-11 place-items-center rounded-full border border-amber-900/15 bg-white/75 text-rose-600 shadow-sm outline-none transition hover:-translate-y-0.5 hover:bg-white hover:text-rose-700 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5 transition group-hover:scale-105"
            >
              <path
                d="M21.7 4.4 18.5 19c-.2 1-.8 1.2-1.6.8l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.7 8.5-7.7c.4-.3-.1-.5-.6-.2L7 13 2.5 11.6c-1-.3-1-1 0-1.4L20 3.5c.8-.3 1.5.2 1.7.9Z"
                fill="currentColor"
              />
            </svg>
          </a>
          <a
            href="https://x.com/INJ_Pass"
            target="_blank"
            rel="noreferrer"
            aria-label="X handle @INJ_Pass"
            title="@INJ_Pass"
            className="grid h-11 w-11 place-items-center rounded-full border border-amber-900/15 bg-white/75 text-amber-950 shadow-sm outline-none transition hover:-translate-y-0.5 hover:bg-white hover:text-rose-700 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
          >
            <span className="font-display text-lg font-black">𝕏</span>
          </a>
          <div ref={languageMenuRef} className="relative">
            <button
              type="button"
              aria-expanded={languageOpen}
              aria-haspopup="listbox"
              aria-label="Switch language"
              onClick={() => setLanguageOpen((open) => !open)}
              className="group inline-flex h-11 items-center gap-2 rounded-full border border-amber-900/15 bg-white/75 px-2.5 pr-3 text-sm font-semibold text-amber-950 shadow-sm outline-none transition hover:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-rose-50 text-rose-600 transition group-hover:bg-rose-100">
                <Languages className="h-4 w-4" />
              </span>
              <span className="min-w-16 text-left">{localeNames[locale]}</span>
              <ChevronDown
                className={`h-4 w-4 text-amber-900/70 transition ${
                  languageOpen ? "rotate-180 text-rose-600" : ""
                }`}
              />
            </button>
            {languageOpen && (
              <div className="absolute right-0 top-full z-50 mt-3 w-44 overflow-hidden rounded-2xl border border-amber-900/15 bg-[#fffaf1]/95 p-1.5 shadow-[0_18px_45px_rgba(127,49,15,0.18)] backdrop-blur-xl">
                <div role="listbox" aria-label="Switch language" className="space-y-1">
                  {localeOrder.map((item) => {
                    const selected = locale === item;
                    const chooseLanguage = () => {
                      setLocale(item);
                      setLanguageOpen(false);
                    };
                    return (
                      <button
                        key={item}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          chooseLanguage();
                        }}
                        onClick={chooseLanguage}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                          selected
                            ? "bg-rose-600 text-white shadow-sm"
                            : "text-amber-950 hover:bg-white/75 hover:text-rose-700"
                        }`}
                      >
                        <span>{localeNames[item]}</span>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            selected ? "bg-white" : "bg-amber-900/15"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <WalletButton label={t.wallet} className="shadow-lg" />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 pt-5 lg:px-8">
        <section className="grid items-center gap-8 border-y border-amber-900/10 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-10">
          <div className="reveal min-w-0">
            <h2
              className={`max-w-4xl font-display text-4xl font-black leading-[1.05] title-gradient md:text-6xl ${
                locale === "zh" ? "whitespace-nowrap" : "whitespace-normal"
              }`}
            >
              {t.heroTitle}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-amber-950/70 md:text-xl">
              {t.heroText}
            </p>

          </div>

          <div className="reveal w-full lg:justify-self-end" style={{ animationDelay: "120ms" }}>
            <div className="relative mx-auto h-[330px] w-full max-w-3xl overflow-hidden sm:h-[390px] lg:h-[430px]">
              <Image
                src="/inj-envelope-hero.jpg"
                alt="INJ Pass red envelope"
                width={1536}
                height={1024}
                priority
                className="h-full w-full scale-[1.12] object-contain object-center"
              />
            </div>
          </div>
        </section>

        <section className="py-10 lg:py-14">
          <div
            className={`relative grid gap-0 ${
              activeFeature
                ? "lg:grid-cols-[minmax(250px,0.78fr)_minmax(0,1.22fr)]"
                : "lg:grid-cols-3"
            }`}
          >
            {t.features.map((feature, index) => {
              const featureType = feature.type as FeatureType;
              return (
              <button
                key={feature.type}
                type="button"
                onClick={() => selectFeature(featureType)}
                aria-expanded={activeFeature === feature.type}
                data-feature-card={feature.type}
                data-state={
                  activeFeature && activeFeature !== feature.type
                    ? "hidden"
                    : activeFeature === feature.type
                      ? "active"
                      : "idle"
                }
                className={`feature-card-shell group text-left ${
                  activeFeature && activeFeature !== feature.type
                    ? "pointer-events-none absolute inset-x-0 top-0 border-transparent py-8 opacity-0"
                    : "relative border-b border-amber-900/10 py-8 opacity-100 hover:bg-white/45 lg:border-b-0 lg:border-r lg:px-6"
                } ${activeFeature === feature.type ? "lg:border-r" : ""} ${
                  !activeFeature && index === t.features.length - 1
                    ? "lg:border-r-0"
                    : ""
                }`}
              >
                <FeatureVisual
                  amountLabel={packetPreview.amountLabel}
                  claimedPercent={packetPreview.claimedPercent}
                  claimCodeLetters={packetPreview.claimCodeLetters}
                  labels={t.visual}
                  type={featureType}
                />
                <p className="mt-6 text-xs font-bold uppercase text-rose-700">
                  {feature.kicker}
                </p>
                <h4 className="mt-2 text-2xl font-bold text-amber-950">
                  {feature.title}
                </h4>
                <p className="mt-3 min-h-14 leading-7 text-amber-900/70">
                  {feature.desc}
                </p>
                <div className="mt-5 inline-flex items-center gap-2 font-bold text-rose-700">
                  {feature.action}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </button>
              );
            })}
            {activeFeatureData && (
              <FeatureDetailPanel
                onBack={() => setActiveFeature(null)}
                panelRef={featurePanelRef}
                type={activeFeatureData.type as FeatureType}
              />
            )}
          </div>

        </section>

        <section className="grid gap-8 border-y border-amber-900/10 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="min-h-44 transition-colors duration-300">
            <p className="text-sm font-bold uppercase text-rose-700">
              Workflow
              {activePrincipleData
                ? ` · ${String((activePrinciple ?? 0) + 1).padStart(2, "0")}`
                : ""}
            </p>
            <h3 className="mt-3 font-display text-4xl text-amber-950 transition-colors duration-300">
              {activePrincipleData?.label ?? t.promiseSection}
            </h3>
            <p className="mt-4 max-w-md leading-7 text-amber-900/70 transition-opacity duration-300">
              {activePrincipleData?.detail ?? t.stepsTitle}
            </p>
            {activePrincipleData && (
              <p className="mt-4 inline-flex rounded-full border border-amber-900/10 bg-white/55 px-4 py-2 text-sm font-bold text-rose-700">
                {activePrincipleData.desc}
              </p>
            )}
          </div>
          <div
            className="grid gap-5 md:grid-cols-3"
            onMouseLeave={() => setActivePrinciple(null)}
          >
            {t.promise.map(({ desc, label, type }, index) => (
              <div
                key={type}
                onFocus={() => setActivePrinciple(index)}
                onMouseEnter={() => setActivePrinciple(index)}
                tabIndex={0}
                className={`border-l pl-5 outline-none transition-all duration-300 ${
                  activePrinciple === index
                    ? "border-rose-500 bg-white/45 py-3 pr-4 shadow-sm"
                    : "border-amber-900/15 py-3 pr-4 hover:border-rose-300 hover:bg-white/35"
                }`}
              >
                <p className="text-sm font-bold text-rose-700">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <h4 className="text-xl font-bold text-amber-950">
                    {label}
                  </h4>
                  <span className="rounded-full border border-amber-900/10 bg-white/60 px-3 py-1 text-xs font-bold text-rose-700">
                    {desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-5 py-10 text-amber-900/70 md:flex-row lg:px-8">
        <p className="text-sm font-medium">{t.footer}</p>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span>Work with AgentOS • Powered by</span>
          <Image
            src="/inj-pass-logo.png"
            alt="Injective"
            width={128}
            height={21}
            className="h-5 w-auto"
            priority
          />
        </div>
      </footer>
    </div>
  );
}
