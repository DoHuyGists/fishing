<script setup lang="ts">
import { computed } from "vue";
import { t as tr } from "../../../i18n/index.ts";
import { equipmentCategories } from "../../../data/equipmentCatalog.ts";
import { useInventoryStore } from "../../../stores/player-inventory-store.ts";
import { useModalStore } from "../../../stores/player-modal-store.ts";
import type { EquipmentSet } from "../../../stores/player-equipment-store.ts";
import type { FishingTool } from "../../../types/model/fishing";

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
const modalStore = useModalStore();

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
    class="slide-fade-in from-left player-content-in flex flex-col gap-1.5 bg-surface-hover border border-border-default rounded-lg p-2 shadow-sm"
  >
    <div class="flex items-center flex-wrap justify-between gap-2 border-b border-border-default pb-1.5">
      <div class="flex items-center gap-2.5">
        <span class="w-2.5 h-2.5 rounded-full bg-content-disabled shrink-0"></span>
        <div>
          <div class="m-0 text-[15px] font-bold text-content tracking-tight leading-snug">
            {{ tr("PrepareModal.danh_sach_set_trang_bi") }}
          </div>
          <div class="m-0 mt-0.5 text-xs text-content-subtle leading-normal">
            {{ tr("PrepareModal.bam_de_doi_set_su_dung_chon_trang_bi_muon_dung_trong_tung_loai") }}
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-if="usedSet && !isUsedSetComplete"
          class="inline-flex items-center gap-1 px-3 py-1 bg-surface border border-gold text-gold text-xs font-semibold rounded-lg"
        >
          {{ tr("PrepareModal.set_chua_du_5_loai") }}
        </span>
        <span
          v-if="usedSet"
          class="inline-flex items-center gap-1 px-3 py-1 bg-surface-selected border border-border text-content-secondary text-xs font-semibold rounded-lg"
        >
          {{ tr("PrepareModal.dang_dung_set") }} {{ usedSetIndex + 1 }}
        </span>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs font-semibold text-content cursor-pointer transition-all duration-150 hover:bg-surface active:scale-95"
          @click="modalStore.open('inventory')"
        >
          <span aria-hidden="true">🎒</span>
          {{ tr("InventoryModal.kho_do") }}
        </button>
      </div>
    </div>

    <!-- Sets Navigation Tabs -->
    <div v-if="inventoryStore.equipmentSets.length > 0" class="flex flex-wrap gap-1.5">
      <button
        v-for="(s, idx) in inventoryStore.equipmentSets"
        :key="s.id"
        type="button"
        class="group flex flex-col items-start gap-0.5 px-2.5 py-1 rounded-lg cursor-pointer text-content transition-all duration-150 border disabled:cursor-not-allowed"
        :class="[
          s.isUsed
            ? '!bg-surface-selected !border-content-disabled !text-content shadow-sm cursor-default'
            : 'bg-surface border-border-default hover:bg-white hover:border-content-disabled',
          switchingSet && !s.isUsed ? 'opacity-60' : '',
        ]"
        :disabled="switchingSet"
        @click="emit('switch-set', s)"
      >
        <div class="flex items-center gap-1.5">
          <span class="text-[13px] font-bold">Set {{ idx + 1 }}</span>
          <span
            v-if="s.isUsed"
            class="text-[10px] font-semibold px-1.5 py-px rounded-full bg-surface-selected text-content-secondary"
            >{{ tr("EquipmentPickerModal.dang_dung") }}</span
          >
          <span
            v-else
            class="text-[10px] font-medium px-1.5 py-px rounded-full bg-surface-hover text-content transition-colors group-hover:bg-border-default group-hover:text-content group-hover:font-semibold"
            >{{ tr("PrepareModal.doi_sang_set_nay") }}</span
          >
          <span
            v-if="!isSetComplete(s)"
            class="text-[10px] font-semibold px-1.5 py-px rounded-md bg-surface border border-gold text-gold"
            >{{ tr("PrepareModal.thieu_loai") }}</span
          >
        </div>
        <span class="text-[11px] text-content-subtle"> {{ countSetItems(s) }} {{ tr("ListItems.vat_pham") }} </span>
      </button>
    </div>

    <!-- Empty state if user has no sets -->
    <div
      v-if="inventoryStore.equipmentSets.length === 0"
      class="p-6 text-center text-[13px] text-content-subtle bg-surface rounded-xl border border-border-default"
    >
      <span>{{ tr("PrepareModal.ban_chua_co_set_trang_bi_nao_trong_kho_do_hay_vao_kho_do_de_tao_") }}</span>
    </div>

    <!-- Category Items in Currently Used Set -->
    <div v-else-if="usedSet">
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5">
        <div
          v-for="cat in equipmentCategories"
          :key="cat.id"
          class="flex flex-col bg-surface border border-border-default rounded-md overflow-hidden min-h-[88px]"
        >
          <!-- Slot Header -->
          <div class="flex items-center justify-between px-1.5 py-1 bg-surface-hover border-b border-border-default">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-semibold text-content">{{ cat.name }}</span>
            </div>
            <span class="text-[11px] text-content-subtle">
              {{ (usedSet[cat.id] || []).length }} {{ tr("PrepareModal.mon") }}
            </span>
          </div>

          <!-- Items list in this category -->
          <div
            class="flex flex-col gap-1 p-1 max-h-[120px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-surface [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
          >
            <template v-if="(usedSet[cat.id] || []).length > 0">
              <div
                v-for="item in usedSet[cat.id]"
                :key="item.id"
                class="group flex items-center gap-1 p-1 rounded cursor-pointer transition-all duration-150 border text-left"
                :class="[
                  isItemSelected(cat.id, item.id)
                    ? '!bg-surface-selected !border-content-disabled shadow-sm'
                    : 'bg-surface border-border-default hover:bg-white hover:border-content-disabled hover:-translate-y-0.5',
                  selectingItemId === String(item.id) ? 'opacity-70 pointer-events-none' : '',
                ]"
                @click="emit('choose-main-item', cat.id, item)"
              >
                <div class="flex items-center justify-center w-6 h-6 shrink-0 bg-surface-hover rounded overflow-hidden">
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
                      class="text-xs font-semibold text-content truncate block"
                      :title="getItemDisplay(item).name"
                    >
                      {{ getItemDisplay(item).name }}
                    </span>
                    <span
                      v-if="isItemSelected(cat.id, item.id)"
                      class="text-[9px] font-bold bg-surface-selected text-content-secondary px-1 py-px rounded shrink-0"
                    >
                      {{ tr("PrepareModal.chinh") }}
                    </span>
                  </div>
                  <span class="text-[11px] text-content-subtle truncate block" :title="getItemDisplay(item).detail">
                    {{ getItemDisplay(item).detail || tr("InventoryModal.trang_bi") }}
                  </span>
                </div>
                <div class="shrink-0">
                  <span
                    v-if="selectingItemId === String(item.id)"
                    class="inline-block w-3.5 h-3.5 border-2 border-border-default border-t-content rounded-full animate-spin"
                  ></span>
                  <span
                    v-else
                    class="text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all duration-150"
                    :class="
                      isItemSelected(cat.id, item.id)
                        ? 'bg-border-default text-content-secondary'
                        : 'bg-surface-hover text-content group-hover:bg-border-default group-hover:text-content group-hover:font-bold'
                    "
                  >
                    {{ isItemSelected(cat.id, item.id) ? tr("PrepareModal.dang_dung") : tr("NewPlayerFishing.chon") }}
                  </span>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-center py-6 px-2 text-[11px] text-content-subtle italic">
                <span class="text-gold font-medium">{{ tr("PrepareModal.chua_co_do") }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
