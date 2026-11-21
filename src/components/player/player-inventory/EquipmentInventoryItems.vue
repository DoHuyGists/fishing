<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { computed } from "vue";
import EquipmentInventoryItemCard from "./EquipmentInventoryItemCard.vue";
import { useEquipmentInventoryTableContext } from "./useEquipmentInventoryTable.ts";

defineEmits<{ "request-delete": [] }>();

const {
  LABELS,
  active,
  activeTab,
  healthStore,
  activeSetNumber,
  allOnPageSelected,
  hasRpc,
  inventoryStore,
  itemPage,
  itemPages,
  itemSearch,
  pagedItems,
  selected,
  toggleSelectPage,
  useSelectedItem,
  usingItemId,
  viewMode,
} = useEquipmentInventoryTableContext();

const categoryName = (category: string) => LABELS[category as keyof typeof LABELS] ?? category;
const groupedPagedItems = computed(() => {
  const groups = new Map<string, typeof pagedItems.value>();
  for (const item of pagedItems.value) {
    const category = item.data.category || "";
    const group = groups.get(category) ?? [];
    group.push(item);
    groups.set(category, group);
  }

  const categoryOrder = Object.keys(LABELS);
  return [...groups.entries()]
    .sort(([first], [second]) => {
      const firstOrder = categoryOrder.indexOf(first);
      const secondOrder = categoryOrder.indexOf(second);
      if (firstOrder !== -1 || secondOrder !== -1) {
        return (firstOrder === -1 ? categoryOrder.length : firstOrder) -
          (secondOrder === -1 ? categoryOrder.length : secondOrder);
      }
      return first.localeCompare(second, "vi");
    })
    .map(([category, items]) => ({ category, items }));
});
const displayedGroups = computed(() =>
  viewMode.value === "grouped" ? groupedPagedItems.value : [{ category: "", items: pagedItems.value }],
);
</script>

<template>
  <div id="user-inventory" class="flex min-w-0 flex-col rounded-lg border border-border bg-white">
    <header class="space-y-3 border-b border-border p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-lg font-semibold">
          {{ tr('InventoryItems.kho_do') }} <span class="text-sm font-normal text-content">({{ inventoryStore.ownedTotal }})</span>
        </div>
        <div class="inline-flex overflow-hidden rounded-md border border-content text-sm" role="group"
          :aria-label="tr('InventoryItems.kieu_hien_thi')">
          <button type="button" :aria-pressed="viewMode === 'grid'"
            :class="['px-3 py-1', viewMode === 'grid' ? 'bg-content text-white' : 'bg-white hover:bg-surface']"
            @click="viewMode = 'grid'">
            {{ tr('CaughtModal.luoi') }}
          </button>
          <button type="button" :aria-pressed="viewMode === 'list'"
            :class="['px-3 py-1', viewMode === 'list' ? 'bg-content text-white' : 'bg-white hover:bg-surface']"
            @click="viewMode = 'list'">
            {{ tr('CaughtModal.danh_sach') }}
          </button>
          <button type="button" :aria-pressed="viewMode === 'grouped'"
            :class="['px-3 py-1', viewMode === 'grouped' ? 'bg-content text-white' : 'bg-white hover:bg-surface']"
            @click="viewMode = 'grouped'">
            {{ tr('InventoryItems.nhom_loai') }}
          </button>
        </div>
      </div>

      <input v-model="itemSearch" type="search" :placeholder="tr('InventoryItems.tim_theo_ten_hoac_loai_vat_pham')"
        class="w-full rounded-md border border-content px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-surface" />

      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label class="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" class="h-4 w-4 accent-accent" :checked="allOnPageSelected"
            @change="toggleSelectPage" />
          {{ tr('InventoryItems.chon_ca_trang') }}
        </label>
        <button type="button" :disabled="selected.size === 0"
          class="rounded-md bg-danger px-3 py-1 text-white hover:bg-danger disabled:cursor-not-allowed disabled:bg-surface disabled:text-content"
          @click="$emit('request-delete')">
          {{ tr('InventoryItems.xoa_da_chon') }}<span v-if="selected.size"> ({{ selected.size }})</span>
        </button>
        <button v-if="selected.size === 1 && hasRpc()" type="button" :disabled="!!usingItemId"
          class="rounded-md bg-accent px-3 py-1 text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          @click="useSelectedItem">
          {{ usingItemId ? tr('InventoryItems.dang_su_dung') : tr('EquipmentSets.su_dung') }}
        </button>
      </div>

      <div v-if="activeTab === 'health' && healthStore.selectedSlot" class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-xs text-content">
        <span>{{ tr('Health.filterSlot', { slot: tr(`Health.slot_${healthStore.selectedSlot}`) }) }} · {{ tr('Health.pickInventoryItem') }}</span>
        <button type="button" class="min-h-8 underline" @click="healthStore.selectedSlot = null">{{ tr('AccountInfoModal.huy') }}</button>
      </div>
      <div v-else-if="activeTab === 'fishing' && active" class="flex items-center justify-between rounded-md bg-surface px-3 py-2 text-sm text-content">
        <span>
          {{ tr('InventoryItems.dang_chon_o') }} <b>{{ LABELS[active.slot] }}</b> {{ tr('InventoryItems.cua_set') }} {{ activeSetNumber }}{{ tr('InventoryItems.bam_vat_pham_de_them') }}
        </span>
        <button type="button" class="ml-2 underline" @click="active = null">{{ tr('AccountInfoModal.huy') }}</button>
      </div>
    </header>

    <div class="min-h-0 max-h-[60dvh] flex-1 overflow-y-scroll p-4">
      <div v-if="pagedItems.length === 0" class="py-12 text-center text-sm text-content">
        {{ inventoryStore.ownedTotal === 0 ? tr('InventoryItems.kho_do_dang_trong') : tr('InventoryItems.khong_co_vat_pham_nao_khop_voi_tim_kiem') }}
      </div>

      <div v-for="group in displayedGroups" :key="group.category" class="mb-4 last:mb-0">
        <div v-if="viewMode === 'grouped'" class="mb-2 text-sm font-semibold text-content">
          {{ categoryName(group.category) || tr('InventoryItems.khac') }}
          <span class="font-normal text-content">({{ group.items.length }})</span>
        </div>
        <div :class="viewMode === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4'">
          <EquipmentInventoryItemCard
            v-for="(item, index) in group.items"
            :key="item.id"
            :style="{ '--delay': `${index * 45}ms` }"
            :item="item"
            :list="viewMode === 'list'"
          />
        </div>
      </div>
    </div>

    <footer v-if="itemPages > 1" class="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
      <button type="button" :disabled="itemPage <= 1 || inventoryStore.viewLoading"
        class="rounded border border-content px-3 py-1 hover:bg-surface disabled:opacity-40"
        @click="itemPage--">
        {{ tr('Fishfarm.truoc') }}
      </button>
      <span class="text-content">{{ tr('CaughtModal.trang') }} {{ itemPage }} / {{ itemPages }}</span>
      <button type="button" :disabled="itemPage >= itemPages || inventoryStore.viewLoading"
        class="rounded border border-content px-3 py-1 hover:bg-surface disabled:opacity-40"
        @click="itemPage++">
        {{ tr('Fishfarm.sau') }}
      </button>
    </footer>
  </div>
</template>
