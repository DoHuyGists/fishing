import { computed, watch } from "vue";
import { defineStore } from "pinia";
import { i18n, type AppLocale } from "../i18n";

const STORAGE_KEY = "fishing.locale";

export const useLocaleStore = defineStore("locale", () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "vi" || saved === "en") i18n.global.locale.value = saved;
  } catch {
    // Language selection remains available when browser storage is disabled.
  }

  function setLocale(value: AppLocale) {
    if (value === "vi" || value === "en") i18n.global.locale.value = value;
  }

  const locale = computed({ get: () => i18n.global.locale.value, set: setLocale });

  watch(locale, (value) => {
    document.documentElement.lang = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Keep the in-memory preference if browser storage is unavailable.
    }
  }, { immediate: true, flush: "sync" });

  return { locale, setLocale };
});
