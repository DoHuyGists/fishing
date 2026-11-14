<script setup lang="ts">
import { computed } from "vue";
import { t as tr } from "../../../i18n/index.ts";
import { equipmentCategories } from "../../../data/equipmentCatalog.ts";
import { useInventoryStore } from "../../../stores/inventory.ts";
import type { EquipmentSet } from "../../../stores/equipment.ts";
import type { FishingTool } from "../../../stores/fishing.ts";

const props = defineProps<{
  usedSet: EquipmentSet | null;
  switchingSet: boolean;
  selectingItemId: string | null;
  isUsedSetComplete: boolean;
  isSetComplete: (set?: EquipmentSet | null) => boolean;
  isItemSelected: (tool: FishingTool, itemId: string | number) => boolean;
}>();

const emit = defineEmits<{
  "switch-set": [set: EquipmentSet];
  "choose-main-item": [tool: FishingTool, item: EquipmentSet[FishingTool][number]];
}>();

const inventoryStore = useInventoryStore();

const usedSetIndex = computed(() => {
  if (!props.usedSet) return 0;
  const idx = inventoryStore.equipmentSets.findIndex((s) => s.id === props.usedSet?.id);
  return idx >= 0 ? idx : 0;
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

function countSetItems(s: EquipmentSet): number {
  return (
    (s.rod?.length || 0) + (s.line?.length || 0) + (s.reel?.length || 0) + (s.hook?.length || 0) + (s.bait?.length || 0)
  );
}
</script>

<template>
  <div
    class="slide-fade-in from-left player-content-in flex flex-col gap-1.5 bg-[#eaf2e5] border border-[#cbd9c6] rounded-lg p-2 shadow-sm"
  >
    <div class="flex items-center flex-wrap justify-between gap-2 border-b border-[#cbd9c6] pb-1.5">
      <div class="flex items-center gap-2.5">
        <span class="w-2.5 h-2.5 rounded-full bg-[#8eaa91] shrink-0"></span>
        <div>
          <div class="m-0 text-[15px] font-bold text-[#24352a] tracking-tight leading-snug">
            {{ tr("PrepareModal.danh_sach_set_trang_bi") }}
          </div>
          <div class="m-0 mt-0.5 text-xs text-[#617565] leading-normal">
            {{ tr("PrepareModal.bam_de_doi_set_su_dung_chon_trang_bi_muon_dung_trong_tung_loai") }}
          </div>
        </div>
      </div>
      <div v-if="usedSet" class="flex items-center gap-2">
        <span
          v-if="!isUsedSetComplete"
          class="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold rounded-lg"
        >
          {{ tr("PrepareModal.set_chua_du_5_loai") }}
        </span>
        <span
          class="inline-flex items-center gap-1 px-3 py-1 bg-[#dce9d7] border border-[#b7cbb4] text-[#344f3b] text-xs font-semibold rounded-lg"
        >
          {{ tr("PrepareModal.dang_dung_set") }} {{ usedSetIndex + 1 }}
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
        @click="emit('switch-set', s)"
      >
        <div class="flex items-center gap-1.5">
          <span class="text-[13px] font-bold">Set {{ idx + 1 }}</span>
          <span
            v-if="s.isUsed"
            class="text-[10px] font-semibold px-1.5 py-px rounded-full bg-[#dce9d7] text-[#344f3b]"
            >{{ tr("EquipmentPickerModal.dang_dung") }}</span
          >
          <span
            v-else
            class="text-[10px] font-medium px-1.5 py-px rounded-full bg-[#eaf2e5] text-[#526a58] transition-colors group-hover:bg-[#cbd9c6] group-hover:text-[#24352a] group-hover:font-semibold"
            >{{ tr("PrepareModal.doi_sang_set_nay") }}</span
          >
          <span
            v-if="!isSetComplete(s)"
            class="text-[10px] font-semibold px-1.5 py-px rounded-md bg-amber-100 border border-amber-300 text-amber-800"
            >{{ tr("PrepareModal.thieu_loai") }}</span
          >
        </div>
        <span class="text-[11px] text-[#617565]"> {{ countSetItems(s) }} {{ tr("ListItems.vat_pham") }} </span>
      </button>
    </div>

    <!-- Empty state if user has no sets -->
    <div
      v-if="inventoryStore.equipmentSets.length === 0"
      class="p-6 text-center text-[13px] text-[#617565] bg-[#f5f9f0] rounded-xl border border-[#cbd9c6]"
    >
      <span>{{ tr("PrepareModal.ban_chua_co_set_trang_bi_nao_trong_kho_do_hay_vao_kho_do_de_tao_") }}</span>
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
            <span class="text-[11px] text-[#617565]">
              {{ (usedSet[cat.id] || []).length }} {{ tr("PrepareModal.mon") }}
            </span>
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
                @click="emit('choose-main-item', cat.id, item)"
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
                      {{ tr("PrepareModal.chinh") }}
                    </span>
                  </div>
                  <span class="text-[11px] text-[#617565] truncate block" :title="getItemDisplay(item).detail">
                    {{ getItemDisplay(item).detail || tr("InventoryModal.trang_bi") }}
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
                    {{
                      isItemSelected(cat.id, item.id)
                        ? tr("PrepareModal.dang_dung")
                        : tr("NewPlayerFishing.chon")
                    }}
                  </span>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-center py-6 px-2 text-[11px] text-[#617565] italic">
                <span class="text-amber-700 font-medium">{{ tr("PrepareModal.chua_co_do") }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
