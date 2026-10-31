<script lang="ts" setup>
import { ref, computed, onMounted } from "vue";
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
import { useWorld2Store } from "../../../stores/world2.ts";
import Modal from "../../shared/Modal.vue";
import { useModalStore } from "../../../stores/modal.ts";

const worldStore = useWorld2Store();
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

/** Currently used set (the only set in use, identified by is_used flag) */
const usedSet = computed(() => {
  return inventoryStore.equipmentSets.find((s) => s.isUsed) ?? inventoryStore.equipmentSets[0] ?? null;
});

const usedSetIndex = computed(() => {
  if (!usedSet.value) return 0;
  const idx = inventoryStore.equipmentSets.findIndex((s) => s.id === usedSet.value?.id);
  return idx >= 0 ? idx : 0;
});

onMounted(async () => {
  loading.value = true;
  error.value = "";
  try {
    await inventoryStore.setEquipmentSet();
  } catch (err: any) {
    error.value = err?.message ?? "Không thể tải trang bị";
  } finally {
    loading.value = false;
  }
});

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
    error.value = err?.message ?? "Không thể đổi set trang bị";
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
    return "Chưa chọn set trang bị nào.";
  }
  if (!isUsedSetComplete.value) {
    return `Set đang chọn thiếu loại: ${missingCategoriesInSet.value.join(", ")} (cần có ít nhất 1 món mỗi loại).`;
  }
  if (!allSlotsReady.value) {
    return `Chưa chọn đủ 5/5 trang bị chính (còn thiếu: ${missingUsedSlots.value.join(", ")}).`;
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
    toast.error(err instanceof Error ? err.message : "Không thể trừ lượt câu cá", {
      title: "Chưa thể vào bãi câu",
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
  <Modal :title="worldStore.selectedArea.title">
    <div class="flex flex-col w-full h-full bg-[#f5f9f0] text-[#24352a] overflow-hidden">
      <!-- Body -->
      <div
        class="flex-1 overflow-y-auto flex flex-col gap-4 pb-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#b7cbb4] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
      >
        <!-- Loading state -->
        <div v-if="loading" class="flex-1 flex flex-col items-center justify-center gap-3.5 text-[#617565] text-sm">
          <div class="w-9 h-9 border-[3px] border-[#cbd9c6] border-t-[#526a58] rounded-full animate-spin"></div>
          <span>Đang tải trang bị…</span>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center gap-2.5 text-center">
          <span class="text-4xl">⚠️</span>
          <p class="m-0 text-red-400 text-sm">{{ error }}</p>
        </div>

        <!-- Content -->
        <template v-else>
          <!-- EQUIPMENT SETS LIST & ITEMS IN USED SET -->
          <div class="flex flex-col gap-1.5 bg-[#eaf2e5] border border-[#cbd9c6] rounded-lg p-2 shadow-sm">
            <div class="flex items-center flex-wrap justify-between gap-2 border-b border-[#cbd9c6] pb-1.5">
              <div class="flex items-center gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-[#8eaa91] shrink-0"></span>
                <div>
                  <h3 class="m-0 text-[15px] font-bold text-[#24352a] tracking-tight leading-snug">
                    Danh sách set trang bị
                  </h3>
                  <p class="m-0 mt-0.5 text-xs text-[#617565] leading-normal">
                    Bấm để đổi set sử dụng. Chọn trang bị muốn dùng trong từng loại.
                  </p>
                </div>
              </div>
              <div v-if="usedSet" class="flex items-center gap-2">
                <span
                  v-if="!isUsedSetComplete"
                  class="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold rounded-lg"
                >
                  ⚠️ Set chưa đủ 5 loại
                </span>
                <span
                  class="inline-flex items-center gap-1 px-3 py-1 bg-[#dce9d7] border border-[#b7cbb4] text-[#344f3b] text-xs font-semibold rounded-lg"
                >
                  ✓ Đang dùng Set {{ usedSetIndex + 1 }}
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
                    >Đang dùng</span
                  >
                  <span
                    v-else
                    class="text-[10px] font-medium px-1.5 py-px rounded-full bg-[#eaf2e5] text-[#526a58] transition-colors group-hover:bg-[#cbd9c6] group-hover:text-[#24352a] group-hover:font-semibold"
                    >Đổi sang set này</span
                  >
                  <span
                    v-if="!isSetComplete(s)"
                    class="text-[10px] font-semibold px-1.5 py-px rounded-md bg-amber-100 border border-amber-300 text-amber-800"
                    >Thiếu loại</span
                  >
                </div>
                <span class="text-[11px] text-[#617565]"> {{ countSetItems(s) }} vật phẩm </span>
              </button>
            </div>

            <!-- Empty state if user has no sets -->
            <div
              v-if="inventoryStore.equipmentSets.length === 0"
              class="p-6 text-center text-[13px] text-[#617565] bg-[#f5f9f0] rounded-xl border border-[#cbd9c6]"
            >
              <span>📦 Bạn chưa có set trang bị nào trong kho đồ. Hãy vào Kho đồ để tạo hoặc mua thêm set.</span>
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
                    <span class="text-[11px] text-[#617565]"> {{ (usedSet[cat.id] || []).length }} món </span>
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
                              Chính
                            </span>
                          </div>
                          <span class="text-[11px] text-[#617565] truncate block" :title="getItemDisplay(item).detail">
                            {{ getItemDisplay(item).detail || "Trang bị" }}
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
                            {{ isItemSelected(cat.id, item.id) ? "✓ Đang dùng" : "Chọn" }}
                          </span>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <div class="flex items-center justify-center py-6 px-2 text-[11px] text-[#617565] italic">
                        <span class="text-amber-700 font-medium">⚠️ Chưa có đồ</span>
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
            :title="proceedBlockReason || 'Sẵn sàng tiếp tục'"
            @click="confirm"
          >
            <span class="text-base">🚀</span>
            Tiếp tục
          </button>
        </div>
      </footer>
    </div>
  </Modal>
</template>
