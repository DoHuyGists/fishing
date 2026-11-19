import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { ref } from "vue";
import { supabaseUserSettingRepository } from "../data/supabaseUserSettingRepository";

export const useUserSettingStore = defineStore("userSetting", () => {
  const userId = ref<string | null>(null);
  const isFishingBackgroundSoundTurnOn = ref(true);
  const loading = ref(false);
  const saving = ref(false);
  const ready = ref(false);
  const error = ref("");
  let revision = 0;

  async function load(id: string | null) {
    const request = ++revision;
    userId.value = id;
    ready.value = false;
    saving.value = false;
    error.value = "";
    isFishingBackgroundSoundTurnOn.value = true;
    loading.value = Boolean(id);
    if (!id) return;
    try {
      const setting = await supabaseUserSettingRepository.fetch(id);
      if (request !== revision) return;
      isFishingBackgroundSoundTurnOn.value = setting?.is_fishing_background_sound_turn_on ?? true;
      ready.value = true;
    } catch {
      if (request === revision) error.value = tr('userSetting.khong_the_tai_cai_dat_am_thanh_vui_long_thu_lai');
    } finally {
      if (request === revision) loading.value = false;
    }
  }

  async function toggleFishingBackgroundSound() {
    if (!userId.value || !ready.value || saving.value) return;
    const id = userId.value;
    const request = revision;
    const previous = isFishingBackgroundSoundTurnOn.value;
    isFishingBackgroundSoundTurnOn.value = !previous;
    saving.value = true;
    error.value = "";
    try {
      await supabaseUserSettingRepository.saveFishingBackgroundSound(id, !previous);
    } catch {
      if (request !== revision) return;
      isFishingBackgroundSoundTurnOn.value = previous;
      error.value = tr('userSetting.khong_the_luu_cai_dat_am_thanh_vui_long_thu_lai');
    } finally {
      if (request === revision) saving.value = false;
    }
  }

  return { userId, isFishingBackgroundSoundTurnOn, loading, saving, ready, error, load, toggleFishingBackgroundSound };
});
