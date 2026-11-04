import { defineStore } from "pinia";
import { ref } from "vue";
import { supabaseFishingPassRepository, type FishingPass, type FishingPassPayload } from "./fishing-pass-admin";

export const useAdminFishingPassStore = defineStore("admin-fishing-pass", () => {
  const passes = ref<FishingPass[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref("");
  async function fetchAll() {
    loading.value = true; error.value = "";
    try { passes.value = await supabaseFishingPassRepository.fetchAll(); }
    catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể tải danh sách vé câu."; }
    finally { loading.value = false; }
  }
  async function save(payload: FishingPassPayload, id?: string) {
    saving.value = true; error.value = "";
    try {
      const saved = id ? await supabaseFishingPassRepository.update(id, payload) : await supabaseFishingPassRepository.create(payload);
      const index = passes.value.findIndex((item) => item.id === saved.id);
      if (index < 0) passes.value.unshift(saved); else passes.value[index] = saved;
      return true;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể lưu vé câu."; return false; }
    finally { saving.value = false; }
  }
  async function remove(id: string) {
    error.value = "";
    try { await supabaseFishingPassRepository.remove(id); passes.value = passes.value.filter((item) => item.id !== id); return true; }
    catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể xoá vé câu."; return false; }
  }
  return { passes, loading, saving, error, fetchAll, save, remove };
});
