import { createI18n } from "vue-i18n";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

export type AppLocale = "vi" | "en";

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: "vi" as AppLocale,
  fallbackLocale: "vi",
  messages: { vi, en } as Record<AppLocale, Record<string, Record<string, string>>>,
  warnHtmlMessage: false,
});

// Also usable in stores, repositories and data helpers without a component setup context.
export function t(key: string, values: Record<string, unknown> = {}): string {
  return i18n.global.t(key, values);
}

export function getFormattingLocale(): string {
  return i18n.global.locale.value === "en" ? "en-US" : "vi-VN";
}
