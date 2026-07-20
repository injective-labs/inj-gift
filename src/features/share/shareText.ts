import type { Locale } from "@/i18n/config";

const labels: Record<
  Locale,
  { link: string; passcode: string; separator: string }
> = {
  zh: { link: "领取链接", passcode: "领取口令", separator: "：" },
  en: { link: "Claim link", passcode: "Claim passcode", separator: ": " },
  ja: { link: "受取リンク", passcode: "受取コード", separator: "：" },
  ko: { link: "수령 링크", passcode: "수령 코드", separator: ": " },
};

export function formatShareText({
  url,
  passcode,
  locale,
}: {
  url: string;
  passcode: string;
  locale: Locale;
}): string {
  const copy = labels[locale];
  return `${copy.link}${copy.separator}${url}\n${copy.passcode}${copy.separator}${passcode}`;
}
