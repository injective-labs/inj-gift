export type Locale = "zh" | "en" | "ja" | "ko";

export const localeOrder: Locale[] = ["zh", "en", "ja", "ko"];

export const localeNames: Record<Locale, string> = {
  zh: "中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
};

/** BCP 47 tags used for the <html lang> attribute. */
export const localeHtmlLang: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en",
  ja: "ja",
  ko: "ko",
};

export const DEFAULT_LOCALE: Locale = "zh";

/** localStorage key used to persist the chosen language across pages/reloads. */
export const LOCALE_STORAGE_KEY = "injgift.locale";

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (localeOrder as string[]).includes(value);
