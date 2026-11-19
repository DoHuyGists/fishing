import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { i18n, t, type AppLocale } from "../i18n";
import { useAuthStore } from "./auth";
import { useUserProfileStore } from "./userProfile";
import { supabaseUserProfileRepository } from "../data/supabaseUserProfileRepository";

const STORAGE_KEY = "fishing.locale";

export const useLocaleStore = defineStore("locale", () => {
  const auth = useAuthStore();
  const userProfile = useUserProfileStore();
  const saving = ref(false);
  const error = ref("");
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "vi" || saved === "en") i18n.global.locale.value = saved;
  } catch {
    // Language selection remains available when browser storage is disabled.
  }

  async function setLocale(value: AppLocale) {
    if ((value !== "vi" && value !== "en") || saving.value) return;
    const previous = i18n.global.locale.value;
    const userId = auth.user?.id;
    error.value = "";
    i18n.global.locale.value = value;
    if (!userId) return;

    saving.value = true;
    try {
      await supabaseUserProfileRepository.updateLanguage(userId, value);
      if (auth.user?.id !== userId) return;
      if (auth.profile?.id === userId) auth.profile.language = value;
      if (userProfile.profile?.id === userId) userProfile.profile.language = value;
    } catch {
      if (auth.user?.id === userId) {
        i18n.global.locale.value = previous;
        error.value = t("language.save_error");
      }
    } finally {
      saving.value = false;
    }
  }

  const locale = computed({
    get: () => i18n.global.locale.value,
    set: (value: AppLocale) => { void setLocale(value); },
  });

  function syncProfileLanguage(profile: { id: string; language: string | null } | null) {
    if (saving.value || profile?.id !== auth.user?.id) return;
    if (profile?.language === "vi" || profile?.language === "en") {
      i18n.global.locale.value = profile.language;
    }
  }

  watch(() => [auth.user?.id, auth.profile?.language] as const,
    () => syncProfileLanguage(auth.profile), { immediate: true });
  watch(() => [auth.user?.id, userProfile.profile?.id, userProfile.profile?.language] as const,
    () => syncProfileLanguage(userProfile.profile), { immediate: true });
  watch(() => auth.user?.id, () => { error.value = ""; });

  watch(locale, (value) => {
    document.documentElement.lang = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Keep the in-memory preference if browser storage is unavailable.
    }
  }, { immediate: true, flush: "sync" });

  return { locale, setLocale, saving, error };
});
