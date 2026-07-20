export function formatShareText({
  url,
  passcode,
}: {
  url: string;
  passcode: string;
}): string {
  const shareUrl = new URL(url);
  shareUrl.hash = new URLSearchParams({ passcode }).toString();
  return shareUrl.toString();
}

export function parseSharePasscode(fragment: string): string {
  return new URLSearchParams(fragment.replace(/^#/, "")).get("passcode") ?? "";
}
