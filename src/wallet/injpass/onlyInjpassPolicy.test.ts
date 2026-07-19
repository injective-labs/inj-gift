import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const forbidden = [
  { label: "browser wallet global", pattern: /window\.ethereum/ },
  { label: "Keplr connector", pattern: /@cosmos-kit\/keplr-extension/ },
  { label: "WalletConnect provider", pattern: /@walletconnect\/ethereum-provider/ },
];

function runtimeSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return runtimeSourceFiles(path);
    if (![".ts", ".tsx"].includes(extname(entry.name))) return [];
    if (/\.test\.[^.]+$/.test(entry.name) || entry.name.endsWith(".d.ts")) return [];
    return [path];
  });
}

describe("INJ Pass-only wallet policy", () => {
  it("contains no alternate-wallet runtime entry points", () => {
    const violations: string[] = [];

    for (const file of runtimeSourceFiles(sourceRoot)) {
      const source = readFileSync(file, "utf8");
      for (const rule of forbidden) {
        if (rule.pattern.test(source)) {
          violations.push(`${relative(process.cwd(), file)}: ${rule.label}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
