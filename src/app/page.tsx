"use client";

import { WalletButton } from "@/components/WalletButton";
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
  Shield,
  Sparkles,
  Trash2,
  WalletCards,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { toast } from "sonner";
import { useGiftAdapter } from "@/hooks/useGiftAdapter";
import { useTx } from "@/hooks/useTx";
import { isBytes32Hex, shortenId } from "@/lib/utils";

type Locale = "zh" | "en" | "ja" | "ko";
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

type MyPacket = {
  id: string;
  createdAt: number;
  amountInj?: string;
  count?: number;
  mode?: string;
  expiresAt?: string;
  token?: string;
  txHash?: string | null;
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

const localeOrder: Locale[] = ["zh", "en", "ja", "ko"];
const localeNames: Record<Locale, string> = {
  zh: "中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
};

const copy = {
  zh: {
    eyebrow: "Injective 红包 · Injective inEVM",
    brandLine: "即发即领的 Injective 红包",
    wallet: "使用 INJ Pass 继续",
    heroTitle: "把好运发到 Injective",
    heroText: "创建、分享、领取，每一步都清清楚楚。",
    primary: "创建红包",
    secondary: "领取红包",
    stats: {
      slots: "红包份数",
      amount: "祝福金额",
      fastest: "最快领取",
    },
    promise: [
      {
        type: "custody" as const,
        label: "托管安全",
        desc: "合约锁定资产",
        detail: "创建红包后，资产先进入合约托管。前端只负责发起交易和展示状态，领取、过期与退款都围绕同一份 Injective 记录推进。",
        icon: Shield,
      },
      {
        type: "speed" as const,
        label: "领取迅速",
        desc: "连接钱包即确认",
        detail: "领取时只需要红包 ID、口令和钱包确认。路径保持短，减少跳页和重复输入，让用户更快完成领取。",
        icon: Zap,
      },
      {
        type: "trace" as const,
        label: "记录透明",
        desc: "状态实时可查",
        detail: "创建记录、领取进度、剩余金额和退款状态都来自 Injective 查询，管理台只做归集展示，方便核对每一步。",
        icon: Sparkles,
      },
    ],
    promiseSection: "了解原理",
    ticket: {
      label: "幸运红包",
      title: "好运到家",
    },
    featureTitle: "三种入口，三种任务",
    featureDesc: "每个入口都有自己的业务语义，不再用同一个红包图案硬套。",
    features: [
      {
        type: "create" as const,
        href: "/create",
        kicker: "发起人",
        title: "创建红包",
        desc: "设置金额、份数和口令，把祝福封进 Injective 红包。",
        action: "马上创建",
      },
      {
        type: "claim" as const,
        href: "/claim",
        kicker: "领取人",
        title: "领取红包",
        desc: "输入红包 ID 与口令，打开属于你的那份好运。",
        action: "去领取",
      },
      {
        type: "mine" as const,
        href: "/packet",
        kicker: "管理台",
        title: "我的红包",
        desc: "查看创建记录、领取进度、剩余金额与退款状态。",
        action: "查看详情",
      },
    ],
    stepsTitle: "红包流转更像一条清晰动线",
    steps: [
      ["01", "封入金额", "选择随机或均分，设置份数与口令。"],
      ["02", "分享口令", "发送红包 ID，让朋友用钱包领取。"],
      ["03", "Injective 确认", "领取、剩余、退款状态都能追踪。"],
    ],
    visual: {
      seal: "封入",
      live: "进行中",
      id: "ID",
      code: "口令",
      claim: "领取",
    },
    footer: "让每一份祝福都更有温度",
  },
  en: {
    eyebrow: "Injective red packets · inEVM",
    brandLine: "Instant-send Injective red packets",
    wallet: "Continue with INJ Pass",
    heroTitle: "Send good fortune to Injective",
    heroText: "Create, share, and claim. Every step stays clear.",
    primary: "Create Packet",
    secondary: "Claim Packet",
    stats: {
      slots: "packet slots",
      amount: "gift value",
      fastest: "fastest claim",
    },
    promise: [
      {
        type: "custody" as const,
        label: "Secured",
        desc: "contract-held funds",
        detail: "After creation, funds move into contract custody. The frontend starts transactions and reads state; claims, expiry, and refunds follow the same Injective record.",
        icon: Shield,
      },
      {
        type: "speed" as const,
        label: "Fast",
        desc: "wallet-ready claims",
        detail: "Claiming keeps the path short: packet ID, passcode, and wallet confirmation. Fewer jumps means the receiver gets through the flow faster.",
        icon: Zap,
      },
      {
        type: "trace" as const,
        label: "Traceable",
        desc: "live packet status",
        detail: "Creation history, claim progress, remaining value, and refunds all come from Injective reads, then the dashboard gathers them into one view.",
        icon: Sparkles,
      },
    ],
    promiseSection: "How it works",
    ticket: {
      label: "Lucky Packet",
      title: "Fortune Arrives",
    },
    featureTitle: "Three entries, three jobs",
    featureDesc:
      "Each path now carries a different visual cue instead of repeating the same red-packet icon.",
    features: [
      {
        type: "create" as const,
        href: "/create",
        kicker: "Sender",
        title: "Create Packet",
        desc: "Set the amount, slots, and passcode, then seal it on Injective.",
        action: "Start creating",
      },
      {
        type: "claim" as const,
        href: "/claim",
        kicker: "Receiver",
        title: "Claim Packet",
        desc: "Enter the packet ID and code to open your share of fortune.",
        action: "Claim now",
      },
      {
        type: "mine" as const,
        href: "/packet",
        kicker: "Dashboard",
        title: "My Packets",
        desc: "Track created packets, claim progress, remaining value, and refunds.",
        action: "View details",
      },
    ],
    stepsTitle: "A cleaner path from send to claim",
    steps: [
      ["01", "Seal funds", "Choose random or equal split, slots, and passcode."],
      ["02", "Share access", "Send the packet ID so friends can claim with a wallet."],
      ["03", "Track Injective", "Claims, balances, and refunds stay visible."],
    ],
    visual: {
      seal: "Seal",
      live: "Live",
      id: "ID",
      code: "Code",
      claim: "Claim",
    },
    footer: "Every gift carries a little more warmth",
  },
  ja: {
    eyebrow: "Injective 紅包 · inEVM",
    brandLine: "すぐ送れてすぐ受け取れる Injective 紅包",
    wallet: "INJ Pass で続ける",
    heroTitle: "幸運を Injective に届ける",
    heroText: "作成、共有、受け取りまで、すべてのステップが明確です。",
    primary: "紅包を作成",
    secondary: "紅包を受け取る",
    stats: {
      slots: "受取枠",
      amount: "ギフト金額",
      fastest: "最速受取",
    },
    promise: [
      {
        type: "custody" as const,
        label: "安全な保管",
        desc: "資産はコントラクトでロック",
        detail: "作成後、資産はコントラクトに保管されます。フロントエンドは取引開始と状態表示に集中し、受取や返金は同じ Injective 記録で進みます。",
        icon: Shield,
      },
      {
        type: "speed" as const,
        label: "すばやく受取",
        desc: "ウォレット接続で確認",
        detail: "受取に必要なのは紅包 ID、合言葉、ウォレット確認だけです。余計な遷移を減らし、受取までの流れを短く保ちます。",
        icon: Zap,
      },
      {
        type: "trace" as const,
        label: "透明な記録",
        desc: "状態をリアルタイムで確認",
        detail: "作成履歴、受取進捗、残高、返金状態は Injective 照会から取得し、管理画面でまとめて確認できます。",
        icon: Sparkles,
      },
    ],
    promiseSection: "仕組み",
    ticket: {
      label: "ラッキー紅包",
      title: "幸運が届く",
    },
    featureTitle: "3つの入口、3つの役割",
    featureDesc:
      "同じ紅包アイコンを使い回さず、それぞれの業務に合う見え方に分けました。",
    features: [
      {
        type: "create" as const,
        href: "/create",
        kicker: "送り手",
        title: "紅包を作成",
        desc: "金額、枠数、合言葉を設定し、祝福を Injective に封入します。",
        action: "作成する",
      },
      {
        type: "claim" as const,
        href: "/claim",
        kicker: "受け取り手",
        title: "紅包を受け取る",
        desc: "紅包 ID と合言葉を入力して、自分の幸運を開きます。",
        action: "受け取る",
      },
      {
        type: "mine" as const,
        href: "/packet",
        kicker: "管理",
        title: "自分の紅包",
        desc: "作成履歴、受取状況、残高、返金状態を確認できます。",
        action: "詳細を見る",
      },
    ],
    stepsTitle: "送るところから受け取りまで、迷わない導線",
    steps: [
      ["01", "金額を封入", "ランダム配分または均等配分、枠数、合言葉を設定。"],
      ["02", "合言葉を共有", "紅包 ID を送り、友人がウォレットで受け取れるようにします。"],
      ["03", "Injective 確認", "受取、残高、返金の状態を追跡できます。"],
    ],
    visual: {
      seal: "封入",
      live: "進行中",
      id: "ID",
      code: "合言葉",
      claim: "受取",
    },
    footer: "すべてのギフトに、少しだけ温度を",
  },
  ko: {
    eyebrow: "Injective 레드 패킷 · inEVM",
    brandLine: "바로 보내고 바로 받는 Injective 레드 패킷",
    wallet: "INJ Pass로 계속하기",
    heroTitle: "행운을 Injective로 보내세요",
    heroText: "생성, 공유, 수령까지 모든 단계가 명확합니다.",
    primary: "레드 패킷 만들기",
    secondary: "레드 패킷 받기",
    stats: {
      slots: "수령 슬롯",
      amount: "선물 금액",
      fastest: "가장 빠른 수령",
    },
    promise: [
      {
        type: "custody" as const,
        label: "안전 보관",
        desc: "컨트랙트가 자산을 잠금",
        detail: "생성 후 자산은 컨트랙트에 보관됩니다. 프론트엔드는 거래 시작과 상태 표시를 맡고, 수령과 환불은 같은 Injective 기록을 기준으로 진행됩니다.",
        icon: Shield,
      },
      {
        type: "speed" as const,
        label: "빠른 수령",
        desc: "지갑 연결 후 바로 확인",
        detail: "수령에는 패킷 ID, 암호, 지갑 확인만 필요합니다. 이동과 반복 입력을 줄여 더 빠르게 받을 수 있습니다.",
        icon: Zap,
      },
      {
        type: "trace" as const,
        label: "투명한 기록",
        desc: "상태를 실시간 조회",
        detail: "생성 기록, 수령 진행률, 잔액, 환불 상태는 Injective 조회에서 오며, 관리 화면에서 한곳에 모아 보여줍니다.",
        icon: Sparkles,
      },
    ],
    promiseSection: "작동 원리",
    ticket: {
      label: "럭키 패킷",
      title: "행운 도착",
    },
    featureTitle: "세 가지 입구, 세 가지 목적",
    featureDesc:
      "같은 레드 패킷 이미지를 반복하지 않고, 각 업무 성격에 맞는 시각 언어로 나눴습니다.",
    features: [
      {
        type: "create" as const,
        href: "/create",
        kicker: "보내는 사람",
        title: "레드 패킷 만들기",
        desc: "금액, 슬롯 수, 암호를 정해 축복을 Injective에 담습니다.",
        action: "바로 만들기",
      },
      {
        type: "claim" as const,
        href: "/claim",
        kicker: "받는 사람",
        title: "레드 패킷 받기",
        desc: "패킷 ID와 암호를 입력하고 내 몫의 행운을 엽니다.",
        action: "받으러 가기",
      },
      {
        type: "mine" as const,
        href: "/packet",
        kicker: "대시보드",
        title: "내 레드 패킷",
        desc: "생성 기록, 수령 진행률, 남은 금액과 환불 상태를 확인합니다.",
        action: "자세히 보기",
      },
    ],
    stepsTitle: "보내기부터 수령까지 더 명확한 흐름",
    steps: [
      ["01", "금액 담기", "랜덤 또는 균등 분배, 슬롯 수와 암호를 설정합니다."],
      ["02", "암호 공유", "패킷 ID를 보내 친구가 지갑으로 받을 수 있게 합니다."],
      ["03", "Injective 확인", "수령, 잔액, 환불 상태를 추적합니다."],
    ],
    visual: {
      seal: "담기",
      live: "진행 중",
      id: "ID",
      code: "암호",
      claim: "수령",
    },
    footer: "모든 선물에 조금 더 따뜻함을",
  },
};

const featurePanelCopy = {
  zh: {
    back: "返回入口",
    create: {
      eyebrow: "创建配置",
      title: "直接在这里完成红包设置",
      desc: "左侧保留业务入口，右侧把金额、份数和口令铺开，不再跳页。",
      amount: "祝福金额",
      slots: "红包份数",
      mode: "分配方式",
      random: "随机",
      equal: "均分",
      passcode: "领取口令",
      action: "封入红包",
      note: "合约锁定后即可分享红包 ID",
    },
    claim: {
      eyebrow: "领取确认",
      title: "输入信息后直接确认领取",
      desc: "",
      id: "红包 ID",
      code: "口令",
      wallet: "钱包状态",
      ready: "INJ Pass 已准备",
      action: "确认领取",
      note: "连接钱包后即可读取领取资格",
    },
    mine: {
      eyebrow: "管理视图",
      title: "Injective 记录和查询放在一起",
      desc: "这里查询真实的 Injective 红包记录，也可以输入红包 ID 打开 Injective 详情。",
    },
  },
  en: {
    back: "Back to entries",
    create: {
      eyebrow: "Create setup",
      title: "Configure the packet right here",
      desc: "The entry stays on the left while amount, slots, and passcode unfold on the right.",
      amount: "Gift value",
      slots: "Packet slots",
      mode: "Split mode",
      random: "Random",
      equal: "Equal",
      passcode: "Claim code",
      action: "Seal packet",
      note: "Share the packet ID once the contract locks the funds",
    },
    claim: {
      eyebrow: "Claim check",
      title: "Enter the details and claim inline",
      desc: "",
      id: "Packet ID",
      code: "Code",
      wallet: "Wallet",
      ready: "INJ Pass ready",
      action: "Confirm claim",
      note: "Connect a wallet to read claim eligibility",
    },
    mine: {
      eyebrow: "Dashboard",
      title: "Progress, balance, and refunds in one view",
      desc: "My Packets now opens as a scannable inline dashboard instead of a pop-up.",
      created: "Created",
      claimed: "Claimed",
      refund: "Refundable",
      action: "View Injective records",
      note: "Status updates as Injective confirmations land",
    },
  },
  ja: {
    back: "入口に戻る",
    create: {
      eyebrow: "作成設定",
      title: "ここで紅包の設定を完了",
      desc: "左に入口を残し、右側に金額、枠数、合言葉を展開します。",
      amount: "ギフト金額",
      slots: "受取枠",
      mode: "配分方式",
      random: "ランダム",
      equal: "均等",
      passcode: "合言葉",
      action: "紅包を封入",
      note: "コントラクトでロック後、紅包 ID を共有できます",
    },
    claim: {
      eyebrow: "受取確認",
      title: "情報を入力してその場で受け取る",
      desc: "",
      id: "紅包 ID",
      code: "合言葉",
      wallet: "ウォレット",
      ready: "INJ Pass 準備完了",
      action: "受取を確認",
      note: "ウォレット接続後、受取資格を確認できます",
    },
    mine: {
      eyebrow: "管理ビュー",
      title: "進捗、残高、返金をまとめて表示",
      desc: "自分の紅包はポップアップではなく、見やすい管理ビューとして開きます。",
      created: "作成済み",
      claimed: "受取済み",
      refund: "返金可能",
      action: "Injective 記録を見る",
      note: "状態は Injective 確認に合わせて更新されます",
    },
  },
  ko: {
    back: "입구로 돌아가기",
    create: {
      eyebrow: "생성 설정",
      title: "여기서 레드 패킷을 바로 설정",
      desc: "왼쪽에는 입구를 남기고, 오른쪽에는 금액, 슬롯, 암호를 펼칩니다.",
      amount: "선물 금액",
      slots: "수령 슬롯",
      mode: "분배 방식",
      random: "랜덤",
      equal: "균등",
      passcode: "수령 암호",
      action: "패킷 담기",
      note: "컨트랙트 잠금 후 패킷 ID를 공유할 수 있습니다",
    },
    claim: {
      eyebrow: "수령 확인",
      title: "정보를 입력하고 바로 수령",
      desc: "",
      id: "패킷 ID",
      code: "암호",
      wallet: "지갑 상태",
      ready: "INJ Pass 준비됨",
      action: "수령 확인",
      note: "지갑 연결 후 수령 가능 여부를 확인합니다",
    },
    mine: {
      eyebrow: "관리 화면",
      title: "진행률, 잔액, 환불 상태를 한눈에",
      desc: "내 레드 패킷은 팝업 대신 스캔하기 쉬운 대시보드로 열립니다.",
      created: "생성됨",
      claimed: "수령됨",
      refund: "환불 가능",
      action: "Injective 기록 보기",
      note: "상태는 Injective 확인에 따라 계속 업데이트됩니다",
    },
  },
};

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
  labels: (typeof copy)[Locale]["visual"];
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
  locale,
  onBack,
  panelRef,
  type,
}: {
  locale: Locale;
  onBack: () => void;
  panelRef?: Ref<HTMLDivElement>;
  type: FeatureType;
}) {
  const panels = featurePanelCopy[locale];
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
  const [createdTxHash, setCreatedTxHash] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [claimPacketId, setClaimPacketId] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [claimAmount, setClaimAmount] = useState<string | null>(null);
  const [packetIdQuery, setPacketIdQuery] = useState("");
  const [myPackets, setMyPackets] = useState<MyPacket[]>([]);
  const createLoading =
    createTxState.status === "signing" || createTxState.status === "pending";
  const claimLoading =
    claimTxState.status === "signing" || claimTxState.status === "pending";
  const isEvm = adapter.stack === "evm";

  useEffect(() => {
    setMyPackets(readMyPackets());
  }, []);

  const saveMyPacket = (id: string, txHash: string | null) => {
    const list = readMyPackets();
    if (list.some((item) => item.id === id)) return;
    const next = [
      {
        id,
        createdAt: Date.now(),
        amountInj,
        count,
        mode,
        expiresAt,
        token: denomOrCw20.trim(),
        txHash,
      },
      ...list,
    ];
    writeMyPackets(next);
    setMyPackets(next);
  };

  const handleCreate = async () => {
    if (adapterError) {
      toast.error(adapterError.message);
      return;
    }
    if (!password.trim()) {
      toast.error("请输入口令");
      return;
    }
    if (!Number.isFinite(count) || count <= 0) {
      toast.error("红包份数不合法");
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
      if (packetId) saveMyPacket(packetId, txHashValue ?? txHash);
      toast.success(`创建成功: ${txHash.slice(0, 10)}...`);
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
    await navigator.clipboard.writeText(
      `${window.location.origin}/claim/${createdPacketId}`,
    );
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
    toast.success("已复制领取链接");
  };

  const handleClaim = async () => {
    if (adapterError) {
      toast.error(adapterError.message);
      return;
    }
    const id = claimPacketId.trim();
    if (!id) {
      toast.error("请输入红包 ID");
      return;
    }
    if (isEvm && !isBytes32Hex(id)) {
      toast.error("红包 ID 格式不正确：必须是 0x + 64 位十六进制");
      return;
    }
    if (!claimPassword.trim()) {
      toast.error("请输入口令");
      return;
    }

    try {
      let amount: string | undefined;
      const txHash = await runClaimTx(async () => {
        const res = await adapter.claimPacket({ id, password: claimPassword });
        amount = res.claimAmount;
        return { hash: res.hash, receipt: res.receipt };
      });
      setClaimTxHash(txHash);
      setClaimAmount(amount ?? null);
      toast.success(`领取成功: ${txHash.slice(0, 10)}...`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "领取失败");
    }
  };

  const refreshMyPackets = () => setMyPackets(readMyPackets());

  const copyStoredClaimLink = async (id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/claim/${id}`);
    toast.success("已复制领取链接");
  };

  const removeStoredPacket = (id: string) => {
    const next = myPackets.filter((packet) => packet.id !== id);
    setMyPackets(next);
    writeMyPackets(next);
  };

  const goPacketDetail = (id = packetIdQuery.trim()) => {
    if (!id) {
      toast.error("请输入红包 ID");
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
                总金额（INJ）
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
                红包份数
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
                Token 类型
              </span>
              <input
                className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                placeholder="INJ 或代币合约地址"
                value={denomOrCw20}
                onChange={(event) => setDenomOrCw20(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-bold text-amber-900/70">
                <Clock className="h-4 w-4 text-orange-500" />
                过期时间
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
              领取口令
            </span>
            <input
              className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 text-lg font-bold text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              placeholder="例如：恭喜发财"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <div>
            <p className="text-sm font-bold text-amber-900/70">分配方式</p>
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
                  {item === "random" ? "随机金额" : "均等分配"}
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
              {createLoading ? "创建中..." : "立即创建红包"}
            </button>
          </div>

          {(createdPacketId || createdTxHash) && (
            <div className="rounded-lg border border-emerald-700/15 bg-emerald-50/80 p-4">
              {createdPacketId && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-emerald-800">
                    红包 ID
                  </p>
                  <div className="flex items-center gap-2 rounded-md bg-white/80 px-3 py-2">
                    <span className="truncate font-mono text-xs text-emerald-950">
                      {createdPacketId}
                    </span>
                    <button
                      type="button"
                      onClick={copyPacketId}
                      className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-700"
                    >
                      {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedId ? "已复制" : "复制"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyClaimLink}
                      className="inline-flex items-center gap-2 rounded-md bg-white/80 px-3 py-2 text-sm font-bold text-emerald-700"
                    >
                      {copiedLink ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                      复制领取链接
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/packet/${createdPacketId}`)}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
                    >
                      查看详情
                    </button>
                  </div>
                </div>
              )}
              {createdTxHash && (
                <p className="mt-3 text-xs font-semibold text-emerald-800">
                  交易哈希：{shortenId(createdTxHash, 10)}
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
              红包 ID
            </span>
            <input
              className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 font-mono text-sm text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              placeholder={isEvm ? "0x..." : "例如：abc123..."}
              value={claimPacketId}
              onChange={(event) => setClaimPacketId(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="flex items-center gap-2 text-sm font-bold text-amber-900/70">
              <Key className="h-4 w-4 text-yellow-600" />
              领取口令
            </span>
            <input
              className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 text-lg font-bold text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              placeholder="输入发起人给你的口令"
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
              {claimLoading ? "领取中..." : "立即领取红包"}
            </button>
          </div>
          {(claimTxHash || claimAmount) && (
            <div className="rounded-lg border border-emerald-700/15 bg-emerald-50/80 p-4 text-sm font-semibold text-emerald-800">
              {claimAmount && <p>领取金额：{claimAmount} 原始单位</p>}
              {claimTxHash && <p>交易哈希：{shortenId(claimTxHash, 10)}</p>}
            </div>
          )}
        </form>
      )}

      {type === "mine" && (
        <div className="mt-8 space-y-6">
          <div className="mt-8 grid gap-0 border-y border-amber-900/10 md:grid-cols-3">
            {[
              ["Injective 记录", myPackets.length],
              ["最近红包", myPackets[0] ? shortenId(myPackets[0].id, 6) : "-"],
              ["详情来源", "Injective"],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={`p-5 ${
                  index < 2 ? "border-b border-amber-900/10 md:border-b-0 md:border-r" : ""
                }`}
              >
                <p className="text-sm font-semibold text-amber-900/60">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-black text-amber-950">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-amber-900/10 bg-white/55 p-4 md:flex-row md:items-end">
            <label className="block flex-1">
              <span className="text-sm font-bold text-amber-900/70">
                查询红包 ID
              </span>
              <input
                className="mt-2 h-12 w-full rounded-lg border border-amber-900/15 bg-white/80 px-4 font-mono text-sm text-amber-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                placeholder="输入红包 ID 查看 Injective 详情"
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
              查看红包详情
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-amber-900/70">
                我创建的红包
              </p>
              <button
                type="button"
                onClick={refreshMyPackets}
                className="text-xs font-bold text-rose-700"
              >
                刷新
              </button>
            </div>
            {myPackets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-900/20 bg-white/45 p-5 text-sm font-semibold text-amber-900/60">
                暂无 Injective 创建记录。你成功创建红包后，会自动出现在这里。
              </div>
            ) : (
              myPackets.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-amber-900/10 bg-white/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-bold text-amber-950">
                        {shortenId(item.id, 12)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-amber-900/60">
                        {item.amountInj ? `${item.amountInj} INJ` : ""}
                        {item.count ? ` · ${item.count} 份` : ""}
                        {item.mode ? ` · ${item.mode === "random" ? "随机" : "均分"}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyStoredClaimLink(item.id)}
                        className="rounded-md bg-white px-3 py-2 text-xs font-bold text-amber-950"
                        title="复制领取链接"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/packet/${item.id}`)}
                        className="rounded-md bg-amber-950 px-3 py-2 text-xs font-bold text-white"
                      >
                        查看
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStoredPacket(item.id)}
                        className="rounded-md bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                        title="移除记录"
                      >
                        <Trash2 className="h-4 w-4" />
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
  const [locale, setLocale] = useState<Locale>("zh");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<FeatureType | null>(null);
  const [activePrinciple, setActivePrinciple] = useState<number | null>(null);
  const [featuredPacket, setFeaturedPacket] =
    useState<FeaturedPacket>(defaultPacket);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const featurePanelRef = useRef<HTMLDivElement>(null);
  const t = copy[locale];

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
            {t.features.map((feature, index) => (
              <button
                key={feature.type}
                type="button"
                onClick={() => selectFeature(feature.type)}
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
                  type={feature.type}
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
            ))}
            {activeFeatureData && (
              <FeatureDetailPanel
                locale={locale}
                onBack={() => setActiveFeature(null)}
                panelRef={featurePanelRef}
                type={activeFeatureData.type}
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
