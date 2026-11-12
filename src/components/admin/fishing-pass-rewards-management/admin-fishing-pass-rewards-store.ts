import type { AdminFishingPass, AdminFishingPassItem } from "../../../types/model/fishingPassRewardsAdmin";
import type { FishingPassRewardPayload, FishingPassRewardRow } from "../../../types/table/fishingPassRewardsAdmin";
import { defineStore } from "pinia";
import { ref } from "vue";
import { supabaseFishingPassRewardsAdminRepository } from "../../../data/supabaseFishingPassRewardsAdminRepository";

export const useAdminFishingPassRewardsStore = defineStore("admin-fishing-pass-rewards", () => {
  const rewards = ref<FishingPassRewardRow[]>([]);
  const passes = ref<AdminFishingPass[]>([]);
  const items = ref<AdminFishingPassItem[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref("");
  async function fetchAll() {
    loading.value = true; error.value = "";
    try {
      const [nextRewards, nextPasses, nextItems] = await Promise.all([supabaseFishingPassRewardsAdminRepository.fetchAll(), supabaseFishingPassRewardsAdminRepository.fetchPasses(), supabaseFishingPassRewardsAdminRepository.fetchItems()]);
      rewards.value = nextRewards; passes.value = nextPasses; items.value = nextItems;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể tải dữ liệu phần thưởng."; }
    finally { loading.value = false; }
  }
  async function save(payload: FishingPassRewardPayload, id?: string) {
    saving.value = true; error.value = "";
    try {
      const row = id ? await supabaseFishingPassRewardsAdminRepository.update(id, payload) : await supabaseFishingPassRewardsAdminRepository.create(payload);
      const index = rewards.value.findIndex((reward) => reward.id === row.id);
      if (index < 0) rewards.value.push(row); else rewards.value[index] = row;
      rewards.value.sort((a, b) => a.passName.localeCompare(b.passName, "vi") || a.dayNumber - b.dayNumber || a.rewardType.localeCompare(b.rewardType));
      return true;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể lưu phần thưởng."; return false; }
    finally { saving.value = false; }
  }
  async function remove(id: string) {
    error.value = "";
    try { await supabaseFishingPassRewardsAdminRepository.remove(id); rewards.value = rewards.value.filter((reward) => reward.id !== id); return true; }
    catch (cause) { error.value = cause instanceof Error ? cause.message : "Không thể xoá phần thưởng."; return false; }
  }
  return { rewards, passes, items, loading, saving, error, fetchAll, save, remove };
});
