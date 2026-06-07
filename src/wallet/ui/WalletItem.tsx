"use client";

import clsx from "clsx";
import { useI18n } from "@/i18n";

export function WalletItem({
  title,
  hint,
  recommended,
  disabled,
  onClick,
}: {
  title: string;
  hint?: string;
  recommended?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "w-full flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition",
        "bg-white hover:bg-gray-50",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "border-gray-200 hover:border-gray-300",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-gray-900 truncate">{title}</div>
          {recommended && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              {t.common.recommended}
            </span>
          )}
        </div>
        {hint && <div className="text-sm text-gray-500 mt-1">{hint}</div>}
      </div>
      <div className="text-gray-400">→</div>
    </button>
  );
}

