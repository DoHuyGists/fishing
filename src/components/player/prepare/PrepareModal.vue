<script lang="ts" setup>
import { t as tr } from "../../../i18n/index.ts";

import { ref, computed, onMounted, watch } from "vue";
import { useAuthStore } from "../../../stores/auth.ts";
import { useInventoryStore } from "../../../stores/inventory.ts";
import { supabaseEquipmentRepository } from "../../../data/supabaseEquipmentRepository.ts";
import { equipmentCategories } from "../../../data/equipmentCatalog.ts";
import type { FishingTool } from "../../../stores/fishing.ts";
import type { EquipmentSet } from "../../../stores/equipment.ts";
import UserTurn from "../stamina/UserTurn.vue";
import { useUserTurnsStore } from "../../../stores/userTurns.ts";
import { supabaseUserInAreaRepository } from "../../../data/supabaseUserInAreaRepository.ts";
import { useToast } from "../../../composables/useToast.ts";
import { useRouter } from "vue-router";
import { useWorldStore } from "../../../stores/worldMap.ts";
import Modal from "../../shared/Modal.vue";
import { useModalStore } from "../../../stores/modal.ts";
import WeatherSection from "../fishing/WeatherSection.vue";
import { useDiaryStore } from "../../../stores/diary.ts";
import PrepareLakeFish from "./PrepareLakeFish.vue";
import PrepareEquipmentSets from "./PrepareEquipmentSets.vue";
import PrepareBodyEquipmentSets from "./PrepareBodyEquipmentSets.vue";
import FishingEquipmentOverview from "../inventory/fishing-equipment/FishingEquipmentOverview.vue";
import HealthOverview from "../inventory/body-equipment/HealthOverview.vue";
import { useHealthStore } from "../../../stores/health.ts";

const worldStore = useWorldStore();
const authStore = useAuthStore();
const inventoryStore = useInventoryStore();
const userTurnsStore = useUserTurnsStore();
const router = useRouter();
const toast = useToast();
const loading = ref(true);
const error = ref("");
const switchingSet = ref(false);
const selectingItemId = ref<string | null>(null);
const modalStore = useModalStore();
const diaryStore = useDiaryStore();
const healthStore = useHealthStore();

watch(
  () => [worldStore.selectedArea.id, authStore.userId] as const,
  ([areaId, userId]) => {
    void diaryStore.loadDiscoveredAreaSpecies(areaId, userId);
  },
  { immediate: true },
);

/** Currently used set (the only set in use, identified by is_used flag) */
const usedSet = computed(() => {
  return inventoryStore.equipmentSets.find((s) => s.isUsed) ?? inventoryStore.equipmentSets[0] ?? null;
});

async function loadData() {
  if (switchingSet.value || selectingItemId.value || healthStore.busy) return;
  loading.value = true;
  error.value = "";
  try {
    await Promise.all([
      inventoryStore.setEquipmentSet(),
      healthStore.loadInventory(),
      diaryStore.loadDiscoveredAreaSpecies(worldStore.selectedArea.id, authStore.userId),
      userTurnsStore.fetchStatus(),
    ]);
  } catch (err: any) {
    error.value = err?.message ?? tr("PrepareModal.khong_the_tai_trang_bi");
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

function isItemSelected(tool: FishingTool, itemId: string | number): boolean {
  const items = usedSet.value?.[tool];
  return Array.isArray(items) && items.some((item) => String(item.id) === String(itemId) && item.is_used === true);
}

function isSlotReady(tool: FishingTool): boolean {
  const items = usedSet.value?.[tool];
  return Array.isArray(items) && items.some((item) => item.is_used === true);
}

/**
 * Đổi set: Chỉ 1 set được sử dụng.
 */
async function switchSet(targetSet: EquipmentSet) {
  if (targetSet.isUsed || switchingSet.value) return;
  switchingSet.value = true;
  error.value = "";
  try {
    if (authStore.userId) {
      await supabaseEquipmentRepository.updateCurrentUsedSet(authStore.userId, targetSet.id);
      await inventoryStore.setEquipmentSet();
    }
  } catch (err: any) {
    error.value = err?.message ?? tr("PrepareModal.khong_the_doi_set_trang_bi");
  } finally {
    switchingSet.value = false;
  }
}

/** Chọn item chính trong set đang dùng bằng selectItem */
async function chooseMainItem(tool: FishingTool, item: any) {
  if (selectingItemId.value) return;
  const itemId = String(item.id);

  if (isItemSelected(tool, itemId)) return;

  selectingItemId.value = itemId;
  try {
    await supabaseEquipmentRepository.selectItem(itemId);
    const items = usedSet.value?.[tool];
    if (Array.isArray(items)) {
      for (const candidate of items) {
        candidate.is_used = String(candidate.id) === itemId;
      }
    }
  } catch (err: any) {
    console.error("Lỗi khi chọn item chính:", err);
  } finally {
    selectingItemId.value = null;
  }
}

const allSlotsReady = computed(() => equipmentCategories.every((cat) => isSlotReady(cat.id)));

/** Kiểm tra set có ít nhất 1 item cho mỗi loại trang bị hay không */
function isSetComplete(s?: EquipmentSet | null): boolean {
  if (!s) return false;
  return equipmentCategories.every((cat) => {
    const list = s[cat.id] as any[];
    return Array.isArray(list) && list.length > 0;
  });
}

/** Set trang bị đang dùng có ít nhất 1 item mỗi loại */
const isUsedSetComplete = computed(() => isSetComplete(usedSet.value));

/** Danh sách loại trang bị còn thiếu trong set đang chọn */
const missingCategoriesInSet = computed(() => {
  if (!usedSet.value) return equipmentCategories.map((c) => c.name);
  return equipmentCategories
    .filter((cat) => {
      const list = usedSet.value![cat.id] as any[];
      return !Array.isArray(list) || list.length === 0;
    })
    .map((cat) => cat.name);
});

/** Danh sách loại trang bị chưa có món được đánh dấu đang dùng */
const missingUsedSlots = computed(() => {
  return equipmentCategories.filter((cat) => !isSlotReady(cat.id)).map((cat) => cat.name);
});

/** Điều kiện cho phép tiếp tục: Không lỗi/loading, set đủ mỗi loại >= 1 item, và đã chọn đủ 5/5 trang bị */
const canProceed = computed(() => {
  return !loading.value && !error.value && !healthStore.loading && !healthStore.busy && isUsedSetComplete.value && allSlotsReady.value;
});

const proceedBlockReason = computed(() => {
  if (loading.value || error.value) return null;
  if (!usedSet.value) {
    return tr("PrepareModal.chua_chon_set_trang_bi_nao");
  }
  if (!isUsedSetComplete.value) {
    return tr("PrepareModal.set_dang_chon_thieu_loai_value0_can_co_it_nhat_1_mon_moi_loai", {
      value0: missingCategoriesInSet.value.join(", "),
    });
  }
  if (!allSlotsReady.value) {
    return tr("PrepareModal.chua_chon_du_5_5_trang_bi_chinh_con_thieu_value0", {
      value0: missingUsedSlots.value.join(", "),
    });
  }
  return null;
});

async function confirm() {
  if (!canProceed.value) return;

  try {
    await userTurnsStore.consumeTurn();
    await supabaseUserInAreaRepository.setUserEnterArea(worldStore.selectedArea.id);
  } catch (err) {
    console.error("Failed to consume turn or enter area:", err);
    toast.error(err instanceof Error ? err.message : tr("PrepareModal.khong_the_tru_luot_cau_ca"), {
      get title() {
        return tr("PrepareModal.chua_the_vao_bai_cau");
      },
      position: "top",
    });
    return;
  } finally {
  }

  router.push({ name: "fishing" });
  modalStore.close();
}
</script>

<template>
  <Modal :title="worldStore.selectedArea.title" :on-refresh="loadData">
    <div class="flex flex-col w-full h-full bg-[#f5f9f0] text-[#24352a] overflow-hidden">
      <!-- Body -->
      <div
        class="flex-1 overflow-y-auto flex flex-col gap-4 pb-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#b7cbb4] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
      >
        <WeatherSection :area-id="worldStore.selectedArea.id" inline />

        <PrepareLakeFish />

        <!-- Loading state -->
        <div v-if="loading" class="flex-1 flex flex-col items-center justify-center gap-3.5 text-[#617565] text-sm">
          <div class="w-9 h-9 border-[3px] border-[#cbd9c6] border-t-[#526a58] rounded-full animate-spin"></div>
          <span>{{ tr("PrepareModal.dang_tai_trang_bi") }}</span>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center gap-2.5 text-center">
          <span class="text-4xl">⚠️</span>
          <div class="m-0 text-red-400 text-sm">{{ error }}</div>
        </div>

        <!-- Content -->
        <template v-else>
          <!-- EQUIPMENT SETS LIST & ITEMS IN USED SET -->
          <FishingEquipmentOverview />
          <PrepareEquipmentSets
            :used-set="usedSet"
            :switching-set="switchingSet"
            :selecting-item-id="selectingItemId"
            :is-used-set-complete="isUsedSetComplete"
            :is-set-complete="isSetComplete"
            :is-item-selected="isItemSelected"
            @switch-set="switchSet"
            @choose-main-item="chooseMainItem"
          />
          <HealthOverview />
          <PrepareBodyEquipmentSets />
        </template>
      </div>

      <!-- Footer -->
      <footer
        class="flex items-center justify-between flex-wrap gap-4 px-7 py-3.5 bg-[#eaf2e5] border-t border-[#cbd9c6]"
      >
        <div
          v-if="proceedBlockReason"
          class="flex items-center gap-2 px-3.5 py-2 bg-amber-100 border border-amber-300 rounded-lg text-amber-800 text-sm leading-snug max-w-[65%]"
        >
          <span class="text-base shrink-0">⚠️</span>
          <span class="font-medium">{{ proceedBlockReason }}</span>
        </div>
        <div v-else class="flex-1"></div>

        <div class="flex items-center gap-3 ml-auto">
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 px-4 py-2 border border-[#344f3b] rounded-xl text-sm font-bold cursor-pointer transition-all duration-150 active:scale-95 bg-[#344f3b] text-[#f5f9f0] shadow-md hover:not-disabled:bg-[#24352a] disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canProceed"
            :title="proceedBlockReason || tr('PrepareModal.san_sang_tiep_tuc')"
            @click="confirm"
          >
            <span class="text-base">🚀</span>
            {{ tr("TeamModal.tiep_tuc") }}
          </button>
        </div>
      </footer>
    </div>
  </Modal>
</template>
