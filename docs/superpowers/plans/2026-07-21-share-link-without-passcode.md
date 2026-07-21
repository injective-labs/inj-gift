# Share Link Without Passcode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy a usable plain claim URL when a persisted packet has no locally stored passcode.

**Architecture:** Extend the existing share-text formatter to accept an optional passcode and return the unmodified URL when it is absent. Reuse that formatter from both persisted-packet copy entry points so behavior stays consistent.

**Tech Stack:** TypeScript, Next.js, Vitest

## Global Constraints

- Preserve the existing passcode-bearing URL fragment behavior.
- Treat copying a plain URL as success.
- Do not change persistence, database, or claim validation.

---

### Task 1: Optional Passcode Share Formatting

**Files:**
- Modify: `src/features/share/shareText.ts`
- Test: `src/features/share/shareText.test.ts`

**Interfaces:**
- Consumes: `formatShareText({ url, passcode })`
- Produces: `formatShareText({ url, passcode?: string }): string`

- [ ] **Step 1: Write the failing test**

```ts
it("returns the plain claim URL when no passcode is available", () => {
  expect(
    formatShareText({
      url: "https://gift.injpass.com/claim/3kP9xQ7m",
    }),
  ).toBe("https://gift.injpass.com/claim/3kP9xQ7m");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/features/share/shareText.test.ts`

Expected: FAIL because `passcode` is currently required.

- [ ] **Step 3: Write minimal implementation**

Make `passcode` optional and return `url` unchanged when it is empty or absent. Preserve the existing fragment formatting when it exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/features/share/shareText.test.ts`

Expected: PASS.

### Task 2: Persisted Packet Copy Fallback

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/packet/page.tsx`

**Interfaces:**
- Consumes: `formatShareText({ url, passcode?: string })`
- Produces: Successful clipboard writes for packets with or without local passcodes.

- [ ] **Step 1: Remove blocking missing-passcode branches**

In both copy handlers, construct the claim URL first and always call:

```ts
await navigator.clipboard.writeText(formatShareText({ url: link, passcode }));
```

- [ ] **Step 2: Preserve success feedback**

Keep the existing localized copy-success toast after the clipboard write.

- [ ] **Step 3: Run targeted verification**

Run: `pnpm test src/features/share/shareText.test.ts src/client/gift/passcodeStore.test.ts`

Expected: PASS.

- [ ] **Step 4: Run type checking**

Run: `pnpm typecheck`

Expected: PASS.
