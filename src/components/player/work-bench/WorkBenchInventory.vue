<script lang="ts" setup>
import type { WorkBenchInventoryItem } from "../../../types/model/workBench";
import { t as tr } from "../../../i18n";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useWorkBenchInventoryStore, type WorkBenchInventoryViewMode } from "../../../stores/workBenchInventory";


const searchQuery = defineModel<string>("searchQuery", { required: true });
const props = defineProps<{
  filteredInventory: WorkBenchInventoryItem[];
  isLoading: boolean;
  errorMessage: string;
}>();

const inventoryViewStore = useWorkBenchInventoryStore();
const { viewMode } = storeToRefs(inventoryViewStore);
const viewModes: { value: WorkBenchInventoryViewMode; labelKey: string }[] = [
  { value: "list", labelKey: "CaughtModal.danh_sach" },
  { value: "grid", labelKey: "CaughtModal.luoi" },
  { value: "group", labelKey: "InventoryItems.nhom_loai" },
];
const displayedGroups = computed(() => inventoryViewStore.displayedGroups(props.filteredInventory));
</script>

<template>
  <aside id="workbench-palette" class="slide-fade-in from-left player-content-in flex min-h-0 flex-col rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
    <div class="mb-3 text-sm font-bold">{{ tr('WorkBenchModal.vat_pham_trong_tui') }}</div>
    <div role="group" :aria-label="tr('InventoryItems.kieu_hien_thi')" class="mb-3 flex flex-wrap gap-1">
      <button
        v-for="mode in viewModes"
        :key="mode.value"
        type="button"
        :aria-pressed="viewMode === mode.value"
        class="flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        :class="viewMode === mode.value ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-[#cbd9c6] bg-white hover:bg-[#e7ecda]'"
        @click="viewMode = mode.value"
      >
        {{ tr(mode.labelKey) }}
      </button>
    </div>
    <input v-model="searchQuery" type="search" :placeholder="tr('ShopModal.tim_vat_pham')" class="mb-3 w-full rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-xs outline-none focus:border-emerald-700" />
    <div v-if="isLoading" class="py-6 text-center text-xs opacity-60">{{ tr('WorkBenchModal.dang_tai_du_lieu') }}</div>
    <div v-else-if="errorMessage" class="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{{ errorMessage }}</div>
    <div v-else class="max-h-[min(65vh,44rem)] overflow-y-auto pr-1 lg:min-h-0 lg:max-h-none lg:flex-1">
      <div v-for="group in displayedGroups" :key="group.category" class="mb-3 last:mb-0">
        <div v-if="viewMode === 'group'" class="mb-2 flex items-center justify-between gap-2 text-xs font-bold">
          <span>{{ group.label }}</span>
          <span class="font-normal opacity-60">({{ group.items.length }})</span>
        </div>
        <div class="grid content-start gap-2" :class="viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-2'">
          <div
            v-for="item in group.items"
            :key="item.id"
            class="flex min-w-0 items-center rounded-md border border-[#cbd9c6] bg-white p-2"
            :class="viewMode === 'list' ? 'gap-2 text-left' : 'flex-col gap-1 text-center'"
          >
            <span class="grid shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f5f9f0] text-xl" :class="viewMode === 'list' ? 'size-10' : 'size-14'">
              <img v-if="item.image" :src="item.image" :alt="item.name" class="h-full w-full object-contain p-1" />
              <span v-else>{{ item.icon || item.name.charAt(0) }}</span>
            </span>
            <span class="line-clamp-2 min-w-0 text-xs font-bold" :class="{ 'flex-1': viewMode === 'list' }" :title="item.name">{{ item.name }}</span>
            <span class="shrink-0 text-[10px] opacity-70">×{{ item.quantity }}</span>
          </div>
        </div>
      </div>
      <div v-if="!filteredInventory.length" class="py-4 text-center text-xs opacity-60">{{ tr('WorkBenchModal.khong_co_vat_pham') }}</div>
    </div>
  </aside>
</template>
