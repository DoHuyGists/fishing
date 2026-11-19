import type { AdminFishingPass, AdminFishingPassItem } from "../../../types/model/fishingPassRewardsAdmin";
import type { FishingPassRewardPayload, FishingPassRewardRow } from "../../../types/table/fishingPassRewardsAdmin";
import { defineStore } from "pinia";
import { ref } from "vue";
import { supabaseFishingPassRewardsAdminRepository } from "../../../data/supabaseFishingPassRewardsAdminRepository";

export const useAdminFishingPassRewardsStore = defineStore("admin-fishing-pass-rewards", () => {
  const rewards = ref<FishingPassRewardRow[]>([]);
  const page = ref(1), total = ref(0), requestId = ref(0), pageSize = 10;
  const search = ref(''), passFilter = ref('ALL'), typeFilter = ref('ALL');
  const passes = ref<AdminFishingPass[]>([]);
  const items = ref<AdminFishingPassItem[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref("");
  async function fetchAll(nextPage = page.value) {
    const request = ++requestId.value;
    loading.value = true; error.value = "";
    try {
      const [result, nextPasses, nextItems] = await Promise.all([supabaseFishingPassRewardsAdminRepository.fetchPage(nextPage, search.value, passFilter.value, typeFilter.value),
        passes.value.length ? Promise.resolve(passes.value) : supabaseFishingPassRewardsAdminRepository.fetchPasses(),
        items.value.length ? Promise.resolve(items.value) : supabaseFishingPassRewardsAdminRepository.fetchItems()]);
      if (request !== requestId.value) return;
      rewards.value = result.items; passes.value = nextPasses; items.value = nextItems; page.value = nextPage; total.value = result.total;
      if (!result.items.length && nextPage > 1) await fetchAll(Math.max(1, Math.ceil(result.total / pageSize)));
    } catch (cause) { if (request === requestId.value) error.value = cause instanceof Error ? cause.message : "Không thể tải dữ liệu phần thưởng."; }
    finally { if (request === requestId.value) loading.value = false; }
  }
  async function save(payload: FishingPassRewardPayload, id?: string) {
    saving.value = true; error.value = "";
    try {
      if (id) await supabaseFishingPassRewardsAdminRepository.update(id, payload); else await supabaseFishingPassRewardsAdminRepository.create(payload);
      await fetchAll();
      return true;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể lưu phần thưởng."; return false; }
    finally { saving.value = false; }
  }
  async function remove(id: string) {
    error.value = "";
    try { await supabaseFishingPassRewardsAdminRepository.remove(id); await fetchAll(); return true; }
    catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể xoá phần thưởng."; return false; }
  }
  return { rewards, passes, items, loading, saving, error, fetchAll, save, remove, page, total, pageSize, requestId, search, passFilter, typeFilter };
});
