<script lang="ts" setup>
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "../../stores/auth";
import { useInventoryStore } from "../../stores/inventory";
import { supabaseEquipmentRepository } from "../../data/supabaseEquipmentRepository";
import { equipmentCategories } from "../../data/equipmentCatalog";
import type { FishingTool } from "../../stores/fishing";
import type { EquipmentSet } from "../../stores/equipment";

const props = defineProps<{
  anchor: any;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "confirm", anchor: any): void;
}>();

const authStore = useAuthStore();
const inventoryStore = useInventoryStore();

const loading = ref(true);
const error = ref("");
const switchingSet = ref(false);
const selectingItemId = ref<string | null>(null);

/* selected item id per slot */
const selected = ref<Partial<Record<FishingTool, string>>>({});

/** Currently used set (the only set in use, identified by is_used flag) */
const usedSet = computed(() => {
  return inventoryStore.equipmentSets.find((s) => s.isUsed) ?? inventoryStore.equipmentSets[0] ?? null;
});

const usedSetIndex = computed(() => {
  if (!usedSet.value) return 0;
  const idx = inventoryStore.equipmentSets.findIndex((s) => s.id === usedSet.value?.id);
  return idx >= 0 ? idx : 0;
});

/** Clear any selected equipment that does not belong to the active set */
function validateSelectedItems(set?: EquipmentSet | null) {
  if (!set) {
    selected.value = {};
    return;
  }
  for (const cat of equipmentCategories) {
    const currentSelectedId = selected.value[cat.id];
    if (currentSelectedId) {
      const existsInSet = (set[cat.id] as any[])?.some((item) => String(item.id) === String(currentSelectedId));
      if (!existsInSet) {
        delete selected.value[cat.id];
      }
    }
  }
}

onMounted(async () => {
  loading.value = true;
  error.value = "";
  try {
    const [sel] = await Promise.all([
      supabaseEquipmentRepository.fetchSelected(authStore.userId),
      inventoryStore.setEquipmentSet(),
    ]);
    selected.value = sel;

    // Các trang bị được chọn sẽ luôn nằm trong set đang dùng
    validateSelectedItems(usedSet.value);
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

/** Find the selected variant info for a given tool slot strictly within the used set */
function selectedVariant(tool: FishingTool): { id: string; name: string; detail: string; icon: string; image?: string } | undefined {
  const id = selected.value[tool];
  if (!id || !usedSet.value) return undefined;

  const list = usedSet.value[tool] as any[];
  if (!Array.isArray(list)) return undefined;

  const found = list.find((it) => String(it.id) === String(id));
  if (!found) return undefined;

  return {
    id: String(found.id),
    name: found.name ?? found.data?.name ?? "Trang bị",
    detail: found.detail ?? found.information ?? found.data?.detail ?? "",
    icon: found.icon ?? found.image ?? found.data?.image ?? "❔",
    image: found.image ?? found.data?.image,
  };
}

function isItemSelected(tool: FishingTool, itemId: string | number): boolean {
  return String(selected.value[tool]) === String(itemId);
}

function countSetItems(s: EquipmentSet): number {
  return (
    (s.rod?.length || 0) +
    (s.line?.length || 0) +
    (s.reel?.length || 0) +
    (s.hook?.length || 0) +
    (s.bait?.length || 0)
  );
}

/**
 * Đổi set: Chỉ 1 set được sử dụng.
 * Việc đổi set sẽ clear các trang bị đã chọn không nằm trong set vừa được đổi.
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
    // Clear các trang bị đã chọn không nằm trong set mới đổi
    validateSelectedItems(usedSet.value);
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

  if (String(selected.value[tool]) === itemId) return;

  selectingItemId.value = itemId;
  try {
    // Call supabaseEquipmentRepository.selectItem (L74)
    await supabaseEquipmentRepository.selectItem(itemId);
    selected.value[tool] = itemId;
  } catch (err: any) {
    console.error("Lỗi khi chọn item chính:", err);
  } finally {
    selectingItemId.value = null;
  }
}

const readySlotsCount = computed(() =>
  equipmentCategories.filter((cat) => !!selected.value[cat.id]).length,
);

const allSlotsReady = computed(() =>
  equipmentCategories.every((cat) => !!selected.value[cat.id]),
);

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

/** Danh sách các ô trang bị chính chưa được chọn */
const missingSelectedSlots = computed(() => {
  return equipmentCategories
    .filter((cat) => !selected.value[cat.id])
    .map((cat) => cat.name);
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
    return `Chưa chọn đủ 5/5 trang bị chính (còn thiếu: ${missingSelectedSlots.value.join(", ")}).`;
  }
  return null;
});

function confirm() {
  if (!canProceed.value) return;
  emit("confirm", props.anchor);
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-md"
        @click.self="emit('close')"
      >
        <div
          class="flex flex-col w-screen h-screen bg-[linear-gradient(160deg,#09172e_0%,#102444_40%,#0b1c35_100%)] text-slate-200 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prepare-title"
        >
          <!-- Header -->
          <header class="flex items-center justify-between px-7 py-4 bg-white/[0.03] border-b border-white/[0.08]">
            <div class="flex items-center gap-3.5">
              <span class="text-3xl drop-shadow-[0_0_10px_rgba(34,197,94,0.4)] select-none">🎣</span>
              <div>
                <h2 id="prepare-title" class="m-0 text-[19px] font-bold text-slate-100 tracking-tight leading-snug">Chuẩn bị vào bãi câu</h2>
                <p class="m-0 mt-0.5 text-[13px] text-slate-400 leading-normal">{{ anchor?.title ?? '' }}</p>
              </div>
            </div>
            <button
              type="button"
              class="flex items-center justify-center w-9 h-9 border-none rounded-xl bg-white/[0.06] text-slate-400 hover:bg-white/[0.12] hover:text-slate-100 transition-colors cursor-pointer"
              aria-label="Đóng"
              @click="emit('close')"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </header>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-7 py-5 flex flex-col gap-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
            <!-- Loading state -->
            <div v-if="loading" class="flex-1 flex flex-col items-center justify-center gap-3.5 text-slate-400 text-sm">
              <div class="w-9 h-9 border-[3px] border-white/10 border-t-emerald-500 rounded-full animate-spin"></div>
              <span>Đang tải trang bị…</span>
            </div>

            <!-- Error state -->
            <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center gap-2.5 text-center">
              <span class="text-4xl">⚠️</span>
              <p class="m-0 text-red-400 text-sm">{{ error }}</p>
            </div>

            <!-- Content -->
            <template v-else>
              <!-- SECTION 1: SELECTED EQUIPMENT (ALWAYS IN USED SET) -->
              <div class="flex flex-col gap-3 bg-white/[0.025] border border-white/[0.06] rounded-2xl p-4 sm:px-5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                <div class="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
                  <div class="flex items-center gap-2.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#22c55e] shrink-0"></span>
                    <div>
                      <h3 class="m-0 text-[15px] font-bold text-slate-50 tracking-tight leading-snug">Trang bị đã chọn</h3>
                      <p class="m-0 mt-0.5 text-xs text-slate-400 leading-normal">Các món đồ chính trong set đang dùng sẽ mang vào bãi câu</p>
                    </div>
                  </div>
                  <div
                    class="text-xs font-semibold px-3 py-1 rounded-full border transition-colors"
                    :class="allSlotsReady ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-400/15 text-amber-400 border-amber-400/30'"
                  >
                    {{ readySlotsCount }}/{{ equipmentCategories.length }} ô đã sẵn sàng
                  </div>
                </div>

                <div class="grid grid-cols-5 gap-3">
                  <div
                    v-for="cat in equipmentCategories"
                    :key="cat.id"
                    class="rounded-xl bg-white/[0.035] border overflow-hidden transition-all duration-200 h-full flex flex-col"
                    :class="selected[cat.id] ? 'border-emerald-500/35 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.1)]' : 'border-amber-400/25'"
                  >
                    <div class="flex items-center gap-2 px-3.5 py-2.5 bg-white/[0.03] border-b border-white/[0.04]">
                      <span class="font-semibold text-[13px] flex-1 text-slate-200 truncate">{{ cat.name }}</span>
                      <span
                        class="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        :class="selected[cat.id] ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-400/15 text-amber-400'"
                      >
                        {{ selected[cat.id] ? '✓ Sẵn sàng' : '✗ Chưa chọn' }}
                      </span>
                    </div>

                    <div class="p-3 flex-1 flex flex-col justify-center">
                      <template v-if="selectedVariant(cat.id)">
                        <div class="flex flex-col gap-2 h-full justify-center">
                          <div class="h-20 flex items-center justify-center">
                            <img
                              v-if="isImageUrl(selectedVariant(cat.id)!.image || selectedVariant(cat.id)!.icon)"
                              :src="selectedVariant(cat.id)!.image || selectedVariant(cat.id)!.icon"
                              alt=""
                              class="h-20 max-w-full object-contain drop-shadow"
                            />
                            <span v-else class="text-4xl select-none">
                              {{ selectedVariant(cat.id)!.icon || '🎣' }}
                            </span>
                          </div>
                          <div class="flex flex-col gap-0.5 text-center">
                            <span class="font-semibold text-[13px] text-slate-100 truncate">{{ selectedVariant(cat.id)!.name }}</span>
                            <span class="text-[11px] text-slate-400 line-clamp-2">{{ selectedVariant(cat.id)!.detail }}</span>
                          </div>
                        </div>
                      </template>
                      <template v-else>
                        <div class="flex flex-col items-center justify-center py-5 text-center">
                          <p class="m-0 text-xs text-slate-400">Chưa chọn {{ cat.name.toLowerCase() }} nào.</p>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>

              <!-- SECTION 2: EQUIPMENT SETS LIST & ITEMS IN USED SET -->
              <div class="flex flex-col gap-3 bg-white/[0.025] border border-white/[0.06] rounded-2xl p-4 sm:px-5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                <div class="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
                  <div class="flex items-center gap-2.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8] shrink-0"></span>
                    <div>
                      <h3 class="m-0 text-[15px] font-bold text-slate-50 tracking-tight leading-snug">Danh sách set trang bị</h3>
                      <p class="m-0 mt-0.5 text-xs text-slate-400 leading-normal">Bấm để đổi set sử dụng. Chọn trang bị chính trong set để hiển thị ở bảng phía trên.</p>
                    </div>
                  </div>
                  <div v-if="usedSet" class="flex items-center gap-2">
                    <span v-if="!isUsedSetComplete" class="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/15 border border-amber-500/35 text-amber-400 text-xs font-semibold rounded-lg">
                      ⚠️ Set chưa đủ 5 loại
                    </span>
                    <span class="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg">
                      ✓ Đang dùng Set {{ usedSetIndex + 1 }}
                    </span>
                  </div>
                </div>

                <!-- Sets Navigation Tabs -->
                <div v-if="inventoryStore.equipmentSets.length > 0" class="flex flex-wrap gap-2.5">
                  <button
                    v-for="(s, idx) in inventoryStore.equipmentSets"
                    :key="s.id"
                    type="button"
                    class="group flex flex-col items-start gap-0.5 px-3.5 py-2 rounded-xl cursor-pointer text-slate-300 transition-all duration-150 border disabled:cursor-not-allowed"
                    :class="[
                      s.isUsed
                        ? '!bg-emerald-500/15 !border-emerald-500 !text-emerald-50 shadow-[0_0_12px_rgba(34,197,94,0.25)] cursor-default'
                        : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20',
                      switchingSet && !s.isUsed ? 'opacity-60' : ''
                    ]"
                    :disabled="switchingSet"
                    @click="switchSet(s)"
                  >
                    <div class="flex items-center gap-1.5">
                      <span class="text-[13px] font-bold">Set {{ idx + 1 }}</span>
                      <span v-if="s.isUsed" class="text-[10px] font-semibold px-1.5 py-px rounded-full bg-emerald-500/20 text-emerald-400">Đang dùng</span>
                      <span v-else class="text-[10px] font-medium px-1.5 py-px rounded-full bg-sky-400/15 text-sky-400 transition-colors group-hover:bg-sky-400 group-hover:text-sky-950 group-hover:font-semibold">Đổi sang set này</span>
                      <span v-if="!isSetComplete(s)" class="text-[10px] font-semibold px-1.5 py-px rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400">Thiếu loại</span>
                    </div>
                    <span class="text-[11px] text-slate-400">
                      {{ countSetItems(s) }} vật phẩm
                    </span>
                  </button>
                </div>

                <!-- Empty state if user has no sets -->
                <div v-if="inventoryStore.equipmentSets.length === 0" class="p-6 text-center text-[13px] text-slate-400 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <span>📦 Bạn chưa có set trang bị nào trong kho đồ. Hãy vào Kho đồ để tạo hoặc mua thêm set.</span>
                </div>

                <!-- Category Items in Currently Used Set -->
                <div v-else-if="usedSet">
                  <div class="grid grid-cols-5 gap-3">
                    <div
                      v-for="cat in equipmentCategories"
                      :key="cat.id"
                      class="flex flex-col bg-white/[0.025] border border-white/[0.06] rounded-xl overflow-hidden min-h-[180px]"
                    >
                      <!-- Slot Header -->
                      <div class="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-b border-white/[0.05]">
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs font-semibold text-slate-200">{{ cat.name }}</span>
                        </div>
                        <span class="text-[11px] text-slate-400">
                          {{ (usedSet[cat.id] || []).length }} món
                        </span>
                      </div>

                      <!-- Items list in this category -->
                      <div class="flex flex-col gap-2 p-2.5 max-h-[240px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                        <template v-if="(usedSet[cat.id] || []).length > 0">
                          <div
                            v-for="item in usedSet[cat.id]"
                            :key="item.id"
                            class="group flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all duration-150 border text-left"
                            :class="[
                              isItemSelected(cat.id, item.id)
                                ? '!bg-emerald-500/15 !border-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.25)]'
                                : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08] hover:border-white/15 hover:-translate-y-0.5',
                              selectingItemId === String(item.id) ? 'opacity-70 pointer-events-none' : ''
                            ]"
                            @click="chooseMainItem(cat.id, item)"
                          >
                            <div class="flex items-center justify-center w-9 h-9 shrink-0 bg-black/20 rounded-md overflow-hidden">
                              <img
                                v-if="isImageUrl(getItemDisplay(item).iconOrImage)"
                                :src="getItemDisplay(item).iconOrImage"
                                :alt="getItemDisplay(item).name"
                                class="h-8 w-8 object-contain"
                              />
                              <span v-else class="text-lg">
                                {{ getItemDisplay(item).iconOrImage }}
                              </span>
                            </div>
                            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                              <div class="flex items-center justify-between gap-1">
                                <span class="text-xs font-semibold text-slate-100 truncate block" :title="getItemDisplay(item).name">
                                  {{ getItemDisplay(item).name }}
                                </span>
                                <span
                                  v-if="isItemSelected(cat.id, item.id)"
                                  class="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-1 py-px rounded shrink-0"
                                >
                                  Chính
                                </span>
                              </div>
                              <span class="text-[11px] text-slate-400 truncate block" :title="getItemDisplay(item).detail">
                                {{ getItemDisplay(item).detail || 'Trang bị' }}
                              </span>
                            </div>
                            <div class="shrink-0">
                              <span v-if="selectingItemId === String(item.id)" class="inline-block w-3.5 h-3.5 border-2 border-white/20 border-t-current rounded-full animate-spin"></span>
                              <span
                                v-else
                                class="text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all duration-150"
                                :class="isItemSelected(cat.id, item.id) ? 'bg-emerald-500/25 text-emerald-300' : 'bg-white/[0.08] text-slate-300 group-hover:bg-sky-400 group-hover:text-sky-950 group-hover:font-bold'"
                              >
                                {{ isItemSelected(cat.id, item.id) ? '✓ Đang dùng' : 'Chọn' }}
                              </span>
                            </div>
                          </div>
                        </template>
                        <template v-else>
                          <div class="flex items-center justify-center py-6 px-2 text-[11px] text-slate-500 italic">
                            <span class="text-amber-400/90 font-medium">⚠️ Chưa có đồ</span>
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
          <footer class="flex items-center justify-between gap-4 px-7 py-3.5 bg-black/25 border-t border-white/[0.06]">
            <div v-if="proceedBlockReason" class="flex items-center gap-2 px-3.5 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200 text-sm leading-snug max-w-[65%]">
              <span class="text-base shrink-0">⚠️</span>
              <span class="font-medium">{{ proceedBlockReason }}</span>
            </div>
            <div v-else class="flex-1"></div>

            <div class="flex items-center gap-3 ml-auto">
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 px-6 py-2.5 border-none rounded-xl text-sm font-bold cursor-pointer transition-all duration-150 active:scale-95 bg-white/[0.08] text-slate-300 hover:bg-white/[0.14]"
                @click="emit('close')"
              >
                Quay lại
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 px-6 py-2.5 border-none rounded-xl text-sm font-bold cursor-pointer transition-all duration-150 active:scale-95 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(34,197,94,0.3)] hover:not-disabled:from-emerald-600 hover:not-disabled:to-emerald-700 hover:not-disabled:shadow-[0_6px_20px_rgba(34,197,94,0.45)] disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </Transition>
  </Teleport>
</template>
