<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { computed } from "vue";
import InventoryItemCard from "./InventoryItemCard.vue";
import { useInventoryTableContext } from "./useInventoryTable.ts";

defineEmits<{ "request-delete": [] }>();

const {
  LABELS,
  active,
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
} = useInventoryTableContext();

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
  <div id="user-inventory" class="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white">
    <header class="space-y-3 border-b border-slate-200 p-4">
      <div class="flex items-center justify-between gap-2">
        <div class="text-lg font-semibold">
          {{ tr('InventoryItems.kho_do') }} <span class="text-sm font-normal text-slate-500">({{ inventoryStore.items.length }})</span>
        </div>
        <div class="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm" role="group"
          :aria-label="tr('InventoryItems.kieu_hien_thi')">
          <button type="button" :aria-pressed="viewMode === 'grid'"
            :class="['px-3 py-1', viewMode === 'grid' ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-100']"
            @click="viewMode = 'grid'">
            {{ tr('CaughtModal.luoi') }}
          </button>
          <button type="button" :aria-pressed="viewMode === 'list'"
            :class="['px-3 py-1', viewMode === 'list' ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-100']"
            @click="viewMode = 'list'">
            {{ tr('CaughtModal.danh_sach') }}
          </button>
          <button type="button" :aria-pressed="viewMode === 'grouped'"
            :class="['px-3 py-1', viewMode === 'grouped' ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-100']"
            @click="viewMode = 'grouped'">
            {{ tr('InventoryItems.nhom_loai') }}
          </button>
        </div>
      </div>

      <input v-model="itemSearch" type="search" :placeholder="tr('InventoryItems.tim_theo_ten_hoac_loai_vat_pham')"
        class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />

      <div class="flex items-center justify-between text-sm">
        <label class="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" class="h-4 w-4 accent-teal-700" :checked="allOnPageSelected"
            @change="toggleSelectPage" />
          {{ tr('InventoryItems.chon_ca_trang') }}
        </label>
        <button type="button" :disabled="selected.size === 0"
          class="rounded-md bg-red-600 px-3 py-1 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          @click="$emit('request-delete')">
          {{ tr('InventoryItems.xoa_da_chon') }}<span v-if="selected.size"> ({{ selected.size }})</span>
        </button>
        <button v-if="selected.size === 1 && hasRpc()" type="button" :disabled="!!usingItemId"
          class="rounded-md bg-teal-700 px-3 py-1 text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          @click="useSelectedItem">
          {{ usingItemId ? tr('InventoryItems.dang_su_dung') : tr('EquipmentSets.su_dung') }}
        </button>
      </div>

      <div v-if="active" class="flex items-center justify-between rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
        <span>
          {{ tr('InventoryItems.dang_chon_o') }} <b>{{ LABELS[active.slot] }}</b> {{ tr('InventoryItems.cua_set') }} {{ activeSetNumber }}{{ tr('InventoryItems.bam_vat_pham_de_them') }}
        </span>
        <button type="button" class="ml-2 underline" @click="active = null">{{ tr('AccountInfoModal.huy') }}</button>
      </div>
    </header>

    <div class="flex-1 p-4">
      <div v-if="pagedItems.length === 0" class="py-12 text-center text-sm text-slate-500">
        {{ inventoryStore.items.length === 0 ? tr('InventoryItems.kho_do_dang_trong') : tr('InventoryItems.khong_co_vat_pham_nao_khop_voi_tim_kiem') }}
      </div>

      <div v-for="group in displayedGroups" :key="group.category" class="mb-4 last:mb-0">
        <div v-if="viewMode === 'grouped'" class="mb-2 text-sm font-semibold text-slate-700">
          {{ categoryName(group.category) || tr('InventoryItems.khac') }}
          <span class="font-normal text-slate-500">({{ group.items.length }})</span>
        </div>
        <div :class="viewMode === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4'">
          <InventoryItemCard v-for="item in group.items" :key="item.id" :item="item" :list="viewMode === 'list'" />
        </div>
      </div>
    </div>

    <footer v-if="itemPages > 1" class="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
      <button type="button" :disabled="itemPage <= 1"
        class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
        @click="itemPage--">
        {{ tr('Fishfarm.truoc') }}
      </button>
      <span class="text-slate-600">{{ tr('CaughtModal.trang') }} {{ itemPage }} / {{ itemPages }}</span>
      <button type="button" :disabled="itemPage >= itemPages"
        class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
        @click="itemPage++">
        {{ tr('Fishfarm.sau') }}
      </button>
    </footer>
  </div>
</template>
