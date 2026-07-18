import type { ReactNode } from "react";

type MineStatsProps = {
  items: ReadonlyArray<{ label: string; value: ReactNode }>;
};

export function MineStats({ items }: MineStatsProps) {
  return (
    <div className="mt-8 grid gap-0 border-y border-amber-900/10 md:grid-cols-3">
      {items.map(({ label, value }, index) => (
        <div
          key={label}
          className={`min-w-0 p-5 ${
            index < 2
              ? "border-b border-amber-900/10 md:border-b-0 md:border-r"
              : ""
          }`}
        >
          <p className="text-sm font-semibold text-amber-900/60">{label}</p>
          <p
            className="mt-2 truncate text-2xl font-black text-amber-950 xl:text-3xl"
            title={typeof value === "string" ? value : undefined}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}
