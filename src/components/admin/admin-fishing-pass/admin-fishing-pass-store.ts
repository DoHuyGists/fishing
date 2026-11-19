import { defineStore } from "pinia";
import { ref } from "vue";
import { supabaseFishingPassRepository, type FishingPass, type FishingPassPayload } from "./fishing-pass-admin";

export const useAdminFishingPassStore = defineStore("admin-fishing-pass", () => {
  const passes = ref<FishingPass[]>([]);
  const page = ref(1), total = ref(0), requestId = ref(0), pageSize = 10;
  const search = ref(''), status = ref('all');
  const loading = ref(false);
  const saving = ref(false);
  const error = ref("");
  async function fetchAll(nextPage = page.value) {
    const request = ++requestId.value;
    loading.value = true; error.value = "";
    try {
      const result = await supabaseFishingPassRepository.fetchPage(nextPage, search.value, status.value);
      if (request !== requestId.value) return;
      passes.value = result.items; page.value = nextPage; total.value = result.total;
      if (!result.items.length && nextPage > 1) await fetchAll(Math.max(1, Math.ceil(result.total / pageSize)));
    }
    catch (cause) { if (request === requestId.value) error.value = cause instanceof Error ? cause.message : "Không thể tải danh sách vé câu."; }
    finally { if (request === requestId.value) loading.value = false; }
  }
  async function save(payload: FishingPassPayload, id?: string) {
    saving.value = true; error.value = "";
    try {
      if (id) await supabaseFishingPassRepository.update(id, payload); else await supabaseFishingPassRepository.create(payload);
      await fetchAll();
      return true;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể lưu vé câu."; return false; }
    finally { saving.value = false; }
  }
  async function remove(id: string) {
    error.value = "";
    try { await supabaseFishingPassRepository.remove(id); await fetchAll(); return true; }
    catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể xoá vé câu."; return false; }
  }
  return { passes, loading, saving, error, fetchAll, save, remove, page, total, pageSize, requestId, search, status };
});
