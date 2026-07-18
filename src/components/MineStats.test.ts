// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { MineStats } from "./MineStats";

describe("MineStats", () => {
  it("constrains long values to their grid cells", () => {
    render(
      createElement(MineStats, {
        items: [
          { label: "Records", value: 2 },
          { label: "Recent", value: "0x73217a...8c1f31" },
          { label: "Source", value: "Injective" },
        ],
      }),
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
