<script lang="ts" setup>
import { t as tr } from "../../../i18n";

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

const usedSetIndex = computed(() => {
  if (!usedSet.value) return 0;
  const idx = inventoryStore.equipmentSets.findIndex((s) => s.id === usedSet.value?.id);
  return idx >= 0 ? idx : 0;
});

async function loadData() {
  if (switchingSet.value || selectingItemId.value) return;
  loading.value = true;
  error.value = "";
  try {
    await Promise.all([
      inventoryStore.setEquipmentSet(),
      diaryStore.loadDiscoveredAreaSpecies(worldStore.selectedArea.id, authStore.userId),
      userTurnsStore.fetchStatus(),
    ]);
  } catch (err: any) {
    error.value = err?.message ?? tr('PrepareModal.khong_the_tai_trang_bi');
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

function isImageUrl(val?: string): boolean {
  if (!val) return false;
  return (
    val.startsWith("http://") ||
    val.startsWith("https://") ||
    val.startsWith("/") ||
    val.startsWith("data:") ||
    val.includes(".png") ||
    val.includes(".jpg") ||
    val.includes(".jpeg") ||
    val.includes(".webp") ||
    val.includes(".svg")
  );
}

function getItemDisplay(item: any) {
  const name = item.name ?? item.data?.name ?? `#${String(item.id).slice(0, 6)}`;
  const detail = item.detail ?? item.information ?? item.data?.detail ?? "";
  const iconOrImage = item.image ?? item.icon ?? item.data?.image ?? item.data?.icon ?? "";
  return { name, detail, iconOrImage };
}

function isItemSelected(tool: FishingTool, itemId: string | number): boolean {
  const items = usedSet.value?.[tool];
  return Array.isArray(items) && items.some((item) => String(item.id) === String(itemId) && item.is_used === true);
}

function isSlotReady(tool: FishingTool): boolean {
  const items = usedSet.value?.[tool];
  return Array.isArray(items) && items.some((item) => item.is_used === true);
}

function countSetItems(s: EquipmentSet): number {
  return (
    (s.rod?.length || 0) + (s.line?.length || 0) + (s.reel?.length || 0) + (s.hook?.length || 0) + (s.bait?.length || 0)
  );
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
    error.value = err?.message ?? tr('PrepareModal.khong_the_doi_set_trang_bi');
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
  return !loading.value && !error.value && isUsedSetComplete.value && allSlotsReady.value;
});

const proceedBlockReason = computed(() => {
  if (loading.value || error.value) return null;
  if (!usedSet.value) {
    return tr('PrepareModal.chua_chon_set_trang_bi_nao');
  }
  if (!isUsedSetComplete.value) {
    return tr('PrepareModal.set_dang_chon_thieu_loai_value0_can_co_it_nhat_1_mon_moi_loai', { value0: missingCategoriesInSet.value.join(", ") });
  }
  if (!allSlotsReady.value) {
    return tr('PrepareModal.chua_chon_du_5_5_trang_bi_chinh_con_thieu_value0', { value0: missingUsedSlots.value.join(", ") });
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
    toast.error(err instanceof Error ? err.message : tr('PrepareModal.khong_the_tru_luot_cau_ca'), {
      get title() { return tr('PrepareModal.chua_the_vao_bai_cau'); },
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

        <section
          :aria-label="tr('EquipmentMenu.ca_trong_ho')"
          class="shrink-0 overflow-hidden rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] shadow-sm"
        >
          <header class="flex flex-wrap items-center justify-between gap-2 border-b border-[#cbd9c6] bg-[#eaf2e5] p-3">
            <div>
              <div class="m-0 text-[15px] font-bold text-[#24352a]">{{ tr('EquipmentMenu.ca_trong_ho') }}</div>
              <div class="m-0 mt-0.5 text-xs text-[#617565]">{{ tr('PrepareModal.cac_loai_ban_da_cau_thanh_cong') }}</div>
            </div>
            <span
              v-if="!diaryStore.isLoadingAreaSpecies && !diaryStore.areaSpeciesError"
              class="text-xs font-semibold text-[#526a58]"
            >
              {{ diaryStore.discoveredAreaSpecies.length }} {{ tr('PrepareModal.loai_da_kham_pha') }}
            </span>
          </header>
          <div v-if="diaryStore.isLoadingAreaSpecies" class="m-0 p-4 text-center text-sm text-[#617565]" role="status">
            {{ tr('PrepareModal.dang_tai_danh_sach_ca') }}
          </div>
          <div v-else-if="diaryStore.areaSpeciesError" class="p-4 text-center" role="alert">
            <div class="m-0 text-sm text-red-600">{{ tr('PrepareModal.khong_the_tai_danh_sach_ca_trong_ho') }}</div>
            <button
              type="button"
              class="mt-2 rounded-lg border border-[#cbd9c6] bg-[#eaf2e5] px-3 py-1.5 text-xs font-semibold text-[#24352a] hover:bg-white"
              @click="diaryStore.loadDiscoveredAreaSpecies(worldStore.selectedArea.id, authStore.userId)"
            >
              {{ tr('Maintenance.thu_lai') }}
            </button>
          </div>
          <div
            v-else-if="diaryStore.discoveredAreaSpecies.length"
            class="m-0 grid list-none grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            <div
              v-for="fish in diaryStore.discoveredAreaSpecies"
              :key="fish.id"
              class="flex items-start gap-3 rounded-lg border border-[#cbd9c6] bg-white/70 p-2.5"
            >
              <img
                :src="fish.image || '/fish/VN/fish.jpg'"
                :alt="fish.name"
                class="h-14 w-16 shrink-0 rounded-md bg-[#eaf2e5] object-contain"
                loading="lazy"
                draggable="false"
              />
              <div class="min-w-0 flex-1">
                <div class="m-0 break-words text-sm font-semibold text-[#24352a]">{{ fish.name }}</div>
                <div v-if="fish.rarity" class="m-0 mt-0.5 text-xs text-[#526a58]">{{ fish.rarity }}</div>
                <div v-if="fish.information" class="m-0 mt-1 text-xs leading-relaxed text-[#617565]">
                  {{ fish.information }}
                </div>
                <div v-if="fish.weight_min != null || fish.weight_max != null" class="m-0 mt-1 text-xs text-[#617565]">
                  {{ tr('LakeFishGuide.can_nang') }} {{ fish.weight_min ?? "?" }}–{{ fish.weight_max ?? "?" }} kg
                </div>
              </div>
            </div>
          </div>
          <div v-else class="m-0 p-4 text-center text-sm text-[#617565]">
            {{ tr('PrepareModal.ban_chua_kham_pha_duoc_loai_ca_nao_trong_ho_nay') }}
          </div>
        </section>

        <!-- Loading state -->
        <div v-if="loading" class="flex-1 flex flex-col items-center justify-center gap-3.5 text-[#617565] text-sm">
          <div class="w-9 h-9 border-[3px] border-[#cbd9c6] border-t-[#526a58] rounded-full animate-spin"></div>
          <span>{{ tr('PrepareModal.dang_tai_trang_bi') }}</span>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center gap-2.5 text-center">
          <span class="text-4xl">⚠️</span>
          <div class="m-0 text-red-400 text-sm">{{ error }}</div>
        </div>

        <!-- Content -->
        <template v-else>
          <!-- EQUIPMENT SETS LIST & ITEMS IN USED SET -->
          <div class="flex flex-col gap-1.5 bg-[#eaf2e5] border border-[#cbd9c6] rounded-lg p-2 shadow-sm">
            <div class="flex items-center flex-wrap justify-between gap-2 border-b border-[#cbd9c6] pb-1.5">
              <div class="flex items-center gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-[#8eaa91] shrink-0"></span>
                <div>
                  <div class="m-0 text-[15px] font-bold text-[#24352a] tracking-tight leading-snug">
                    {{ tr('PrepareModal.danh_sach_set_trang_bi') }}
                  </div>
                  <div class="m-0 mt-0.5 text-xs text-[#617565] leading-normal">
                    {{ tr('PrepareModal.bam_de_doi_set_su_dung_chon_trang_bi_muon_dung_trong_tung_loai') }}
                  </div>
                </div>
              </div>
              <div v-if="usedSet" class="flex items-center gap-2">
                <span
                  v-if="!isUsedSetComplete"
                  class="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold rounded-lg"
                >
                  {{ tr('PrepareModal.set_chua_du_5_loai') }}
                </span>
                <span
                  class="inline-flex items-center gap-1 px-3 py-1 bg-[#dce9d7] border border-[#b7cbb4] text-[#344f3b] text-xs font-semibold rounded-lg"
                >
                  {{ tr('PrepareModal.dang_dung_set') }} {{ usedSetIndex + 1 }}
                </span>
              </div>
            </div>

            <!-- Sets Navigation Tabs -->
            <div v-if="inventoryStore.equipmentSets.length > 0" class="flex flex-wrap gap-1.5">
              <button
                v-for="(s, idx) in inventoryStore.equipmentSets"
                :key="s.id"
                type="button"
                class="group flex flex-col items-start gap-0.5 px-2.5 py-1 rounded-lg cursor-pointer text-[#405446] transition-all duration-150 border disabled:cursor-not-allowed"
                :class="[
                  s.isUsed
                    ? '!bg-[#dce9d7] !border-[#8eaa91] !text-[#24352a] shadow-sm cursor-default'
                    : 'bg-[#f5f9f0] border-[#cbd9c6] hover:bg-white hover:border-[#8eaa91]',
                  switchingSet && !s.isUsed ? 'opacity-60' : '',
                ]"
                :disabled="switchingSet"
                @click="switchSet(s)"
              >
                <div class="flex items-center gap-1.5">
                  <span class="text-[13px] font-bold">Set {{ idx + 1 }}</span>
                  <span
                    v-if="s.isUsed"
                    class="text-[10px] font-semibold px-1.5 py-px rounded-full bg-[#dce9d7] text-[#344f3b]"
                    >{{ tr('EquipmentPickerModal.dang_dung') }}</span
                  >
                  <span
                    v-else
                    class="text-[10px] font-medium px-1.5 py-px rounded-full bg-[#eaf2e5] text-[#526a58] transition-colors group-hover:bg-[#cbd9c6] group-hover:text-[#24352a] group-hover:font-semibold"
                    >{{ tr('PrepareModal.doi_sang_set_nay') }}</span
                  >
                  <span
                    v-if="!isSetComplete(s)"
                    class="text-[10px] font-semibold px-1.5 py-px rounded-md bg-amber-100 border border-amber-300 text-amber-800"
                    >{{ tr('PrepareModal.thieu_loai') }}</span
                  >
                </div>
                <span class="text-[11px] text-[#617565]"> {{ countSetItems(s) }} {{ tr('ListItems.vat_pham') }} </span>
              </button>
            </div>

            <!-- Empty state if user has no sets -->
            <div
              v-if="inventoryStore.equipmentSets.length === 0"
              class="p-6 text-center text-[13px] text-[#617565] bg-[#f5f9f0] rounded-xl border border-[#cbd9c6]"
            >
              <span>{{ tr('PrepareModal.ban_chua_co_set_trang_bi_nao_trong_kho_do_hay_vao_kho_do_de_tao_') }}</span>
            </div>

            <!-- Category Items in Currently Used Set -->
            <div v-else-if="usedSet">
              <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5">
                <div
                  v-for="cat in equipmentCategories"
                  :key="cat.id"
                  class="flex flex-col bg-[#f5f9f0] border border-[#cbd9c6] rounded-md overflow-hidden min-h-[88px]"
                >
                  <!-- Slot Header -->
                  <div class="flex items-center justify-between px-1.5 py-1 bg-[#eaf2e5] border-b border-[#cbd9c6]">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-semibold text-[#24352a]">{{ cat.name }}</span>
                    </div>
                    <span class="text-[11px] text-[#617565]"> {{ (usedSet[cat.id] || []).length }} {{ tr('PrepareModal.mon') }} </span>
                  </div>

                  <!-- Items list in this category -->
                  <div
                    class="flex flex-col gap-1 p-1 max-h-[120px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#b7cbb4] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
                  >
                    <template v-if="(usedSet[cat.id] || []).length > 0">
                      <div
                        v-for="item in usedSet[cat.id]"
                        :key="item.id"
                        class="group flex items-center gap-1 p-1 rounded cursor-pointer transition-all duration-150 border text-left"
                        :class="[
                          isItemSelected(cat.id, item.id)
                            ? '!bg-[#dce9d7] !border-[#8eaa91] shadow-sm'
                            : 'bg-[#f5f9f0] border-[#cbd9c6] hover:bg-white hover:border-[#8eaa91] hover:-translate-y-0.5',
                          selectingItemId === String(item.id) ? 'opacity-70 pointer-events-none' : '',
                        ]"
                        @click="chooseMainItem(cat.id, item)"
                      >
                        <div
                          class="flex items-center justify-center w-6 h-6 shrink-0 bg-[#eaf2e5] rounded overflow-hidden"
                        >
                          <img
                            v-if="isImageUrl(getItemDisplay(item).iconOrImage)"
                            :src="getItemDisplay(item).iconOrImage"
                            :alt="getItemDisplay(item).name"
                            class="h-5 w-5 object-contain"
                          />
                          <span v-else class="text-lg">
                            {{ getItemDisplay(item).iconOrImage }}
                          </span>
                        </div>
                        <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div class="flex items-center justify-between gap-1">
                            <span
                              class="text-xs font-semibold text-[#24352a] truncate block"
                              :title="getItemDisplay(item).name"
                            >
                              {{ getItemDisplay(item).name }}
                            </span>
                            <span
                              v-if="isItemSelected(cat.id, item.id)"
                              class="text-[9px] font-bold bg-[#dce9d7] text-[#344f3b] px-1 py-px rounded shrink-0"
                            >
                              {{ tr('PrepareModal.chinh') }}
                            </span>
                          </div>
                          <span class="text-[11px] text-[#617565] truncate block" :title="getItemDisplay(item).detail">
                            {{ getItemDisplay(item).detail || tr('InventoryModal.trang_bi') }}
                          </span>
                        </div>
                        <div class="shrink-0">
                          <span
                            v-if="selectingItemId === String(item.id)"
                            class="inline-block w-3.5 h-3.5 border-2 border-[#cbd9c6] border-t-[#526a58] rounded-full animate-spin"
                          ></span>
                          <span
                            v-else
                            class="text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all duration-150"
                            :class="
                              isItemSelected(cat.id, item.id)
                                ? 'bg-[#cbd9c6] text-[#344f3b]'
                                : 'bg-[#eaf2e5] text-[#526a58] group-hover:bg-[#cbd9c6] group-hover:text-[#24352a] group-hover:font-bold'
                            "
                          >
                            {{ isItemSelected(cat.id, item.id) ? tr('PrepareModal.dang_dung') : tr('NewPlayerFishing.chon') }}
                          </span>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <div class="flex items-center justify-center py-6 px-2 text-[11px] text-[#617565] italic">
                        <span class="text-amber-700 font-medium">{{ tr('PrepareModal.chua_co_do') }}</span>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
            {{ tr('TeamModal.tiep_tuc') }}
          </button>
        </div>
      </footer>
    </div>
  </Modal>
</template>
