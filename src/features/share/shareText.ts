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

export function parseClaimShareInput(
  pathReference: string,
  fragment: string,
): { reference: string; passcode: string } {
  const decodedReference = decodeURIComponent(pathReference);
  const reference = decodedReference.match(
    /^(?:0x[a-fA-F0-9]{64}|[1-9A-HJ-NP-Za-km-z]{8})(?=\s|$)/,
  )?.[0] ?? decodedReference;
  const legacyPasscode = decodedReference.match(
    /(?:Claim passcode|领取口令|受取コード|수령 코드)\s*[:：]\s*(.+)$/i,
  )?.[1]?.trim() ?? "";
  return {
    reference,
    passcode: parseSharePasscode(fragment) || legacyPasscode,
  };
}
