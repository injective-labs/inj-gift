# Mine Panel Overflow Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the recent packet ID from overlapping the source statistic in the expanded My Packets panel at every supported viewport width.

**Architecture:** Extract the statistics markup into a focused presentational `MineStats` component so its overflow contract can be tested without wallet or transaction providers. Keep the existing data flow in `FeatureDetailPanel`; only the rendered layout constraints change.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vitest, Testing Library

## Global Constraints

- Keep the existing one-column mobile and three-column `md` layout.
- Preserve full values in component props and application state; clipping is presentation-only.
- Do not change the query form, packet-list actions, local storage format, or wallet behavior.
- Verify populated layouts at 390 px, 768 px, 1024 px, and 2048 px.

---

### Task 1: Add a constrained statistics component

**Files:**
- Create: `src/components/MineStats.tsx`
- Create: `src/components/MineStats.test.tsx`
- Modify: `src/app/page.tsx:710-733`

**Interfaces:**
- Consumes: `items: ReadonlyArray<{ label: string; value: ReactNode }>` from `FeatureDetailPanel`.
- Produces: `MineStats({ items }: MineStatsProps): JSX.Element`, preserving the existing grid and border behavior.

- [ ] **Step 1: Write the failing regression test**

Create `src/components/MineStats.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MineStats } from "./MineStats";

describe("MineStats", () => {
  it("constrains long values to their grid cells", () => {
    render(
      <MineStats
        items={[
          { label: "Records", value: 2 },
          { label: "Recent", value: "0x73217a...8c1f31" },
          { label: "Source", value: "Injective" },
        ]}
      />,
    );

    expect(screen.getByText("Recent").parentElement).toHaveClass("min-w-0");
    expect(screen.getByText("0x73217a...8c1f31")).toHaveClass(
      "truncate",
      "text-2xl",
      "xl:text-3xl",
    );
    expect(screen.getByText("Source")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- src/components/MineStats.test.tsx`

Expected: FAIL because `./MineStats` does not exist.

- [ ] **Step 3: Add the minimal presentational component**

Create `src/components/MineStats.tsx`:

```tsx
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
```

- [ ] **Step 4: Replace the inline statistics markup**

Import `MineStats` in `src/app/page.tsx`, then replace the current mapped statistics grid with:

```tsx
<MineStats
  items={[
    { label: panels.mine.records, value: myPackets.length },
    {
      label: panels.mine.recent,
      value: myPackets[0] ? shortenId(myPackets[0].id, 6) : "-",
    },
    { label: panels.mine.source, value: "Injective" },
  ]}
/>
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `pnpm test -- src/components/MineStats.test.tsx`

Expected: PASS with one passing test.

- [ ] **Step 6: Run project verification**

Run: `pnpm test && pnpm typecheck && pnpm lint`

Expected: all tests pass, TypeScript exits 0, and ESLint exits 0.

- [ ] **Step 7: Verify responsive rendering**

Populate `injgift.myPackets` with a bytes32 packet ID, expand My Packets, and capture the panel at 390x844, 768x900, 1024x900, and 2048x1135. At every width, confirm the recent value remains inside the second statistics cell, the source value is readable, and no query or packet-list controls regress.

- [ ] **Step 8: Commit the implementation**

```bash
git add src/components/MineStats.tsx src/components/MineStats.test.tsx src/app/page.tsx
git commit -m "fix: constrain mine panel statistics"
```

