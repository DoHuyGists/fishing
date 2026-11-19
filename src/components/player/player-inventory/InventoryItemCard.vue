<script setup lang="ts">
import type { UserInventory } from "../../../types/model/userInventory";
import { computed } from "vue";
import { getFormattingLocale, t as tr } from "../../../i18n";
import { useInformationModal } from "../../../composables/useInformationModal";

import type { ItemData } from "../../../stores/equipment";
import { useInventoryTableContext } from "./useInventoryTable";
import { healthEquipment } from '../../../data/healthEquipment';

const props = defineProps<{ item: UserInventory; list?: boolean }>();
const { open } = useInformationModal();
const { LABELS, activeTab, healthStore, hasActiveSlot, isCompatible, isInActiveSlot, itemName, pickItem, selected, toggleSelect } =
  useInventoryTableContext();

const data = computed(() => props.item.data as ItemData);
const healthItem = computed(() => healthEquipment(props.item));
const name = computed(() => itemName(data.value, props.item.id));
const category = computed(() => LABELS[data.value.category] ?? data.value.category);
const description = computed(() => {
  const value = data.value.information || data.value.detail;
  return typeof value === "string" ? value : "";
});
const classification = computed(() =>
  typeof data.value.classification === "string" ? data.value.classification : "",
);
const icon = computed(() => typeof data.value.icon === "string" ? data.value.icon : "");
const details = computed(() => {
  const rows: { label: string; value: string }[] = [];
  const addNumber = (key: string, label: string, style: "decimal" | "percent" = "decimal", unit = "") => {
    const value = data.value[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    rows.push({ label, value: `${value.toLocaleString(getFormattingLocale(), { style, maximumFractionDigits: 2 })}${unit}` });
  };

  addNumber("quantity", tr('ShopModal.so_luong'));
  addNumber("max_weight", tr('InventoryItemCard.tai_trong_toi_da'), "decimal", " kg");
  addNumber("pull_strength", tr('InventoryItemCard.suc_keo'));
  addNumber("durability", tr('InventoryItemCard.do_ben'));
  addNumber("catch_rate", tr('InventoryItemCard.bonus_moc_ca'), "percent");
  addNumber("luck_bonus", tr('InventoryItemCard.may_man'));
  if (activeTab.value === 'health') {
    for (const [id, bonus] of Object.entries(healthItem.value.bonuses)) {
      rows.push({ label: tr(`Health.${id}`), value: `+${bonus?.toLocaleString(getFormattingLocale())}` });
    }
  }

  const fishTypes = data.value.fish_type;
  if (Array.isArray(fishTypes)) {
    const value = fishTypes.filter((type): type is string => typeof type === "string" && type.trim() !== "").join(", ");
    if (value) rows.push({ label: tr('InventoryItemCard.nhom_ca'), value });
  }
  return rows;
});

function showDetails() {
  open({
    name: name.value,
    image: typeof data.value.image === "string" ? data.value.image : undefined,
    description: [
      category.value,
      classification.value,
      description.value,
      ...details.value.map(({ label, value }) => `${label}: ${value}`),
    ].filter(Boolean).join("\n\n"),
  });
}
</script>

<template>
  <div :class="[
    'slide-fade-in from-bottom player-content-in relative min-w-0 cursor-pointer rounded-md border text-[#24352a] transition',
    list ? 'flex items-start gap-3 px-3 py-2' : 'p-3',
    selected.has(item.id) ? 'border-red-400 bg-red-50' : 'border-[#cbd9c6] bg-white hover:bg-[#f5f9f0]',
    hasActiveSlot && isCompatible(item) ? 'ring-2 ring-teal-400' : '',
    hasActiveSlot && !isCompatible(item) ? 'opacity-40' : '',
  ]" @click="pickItem(item)">
    <input type="checkbox" class="h-4 w-4 accent-red-600"
      :class="list ? 'mt-1 shrink-0' : 'absolute left-2 top-2'" :checked="selected.has(item.id)"
      :aria-label="tr('InventoryItems.chon_value0_de_xoa', { value0: name })" @click.stop
      @change="toggleSelect(item.id)" />

    <div :class="[
      'flex items-center justify-center overflow-hidden rounded bg-[#f5f9f0] text-slate-400',
      list ? 'h-12 w-12 shrink-0' : 'mx-auto mb-2 h-16 w-16',
    ]">
      <img v-if="data.image" :src="data.image" :alt="name" loading="lazy" class="h-full w-full object-contain" />
      <span v-else class="text-lg font-semibold">{{ icon || name.charAt(0).toUpperCase() }}</span>
    </div>

    <div class="min-w-0 flex-1">
      <div :class="list ? '' : 'text-center'">
        <div class="break-words text-sm font-medium">{{ name }}</div>
        <div class="break-words text-xs text-slate-500">{{ category }}</div>
        <div v-if="classification" class="mt-1 break-words text-xs font-semibold text-teal-700">{{ classification }}</div>
      </div>
      <div class="mt-2" :class="list ? '' : 'text-center'">
        <button type="button"
          class="cursor-pointer rounded border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1 text-xs text-[#24352a] hover:bg-[#cbd9c6]/50 focus-visible:outline-2 focus-visible:outline-offset-2"
          @click.stop="showDetails">
          {{ tr('InventoryItemCard.xem_chi_tiet') }}
        </button>
      </div>
      <div v-if="details.length" class="mt-2 space-y-1 border-t border-[#cbd9c6] pt-2 text-xs">
        <div v-for="detail in details" :key="detail.label" class="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
          <span class="text-slate-500">{{ detail.label }}</span>
          <span class="min-w-0 break-words font-medium">{{ detail.value }}</span>
        </div>
      </div>
      <div v-if="isInActiveSlot(item)" class="mt-2 text-xs font-medium text-teal-700" :class="list ? '' : 'text-center'">
        {{ activeTab === 'health' ? tr('Health.equipped') : tr('InventoryItems.da_them') }}
      </div>
      <button v-if="activeTab === 'health' && healthItem.slot" type="button"
        class="mt-2 min-h-8 w-full rounded border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1 text-xs disabled:opacity-50"
        :disabled="!healthStore.selectedSlot || !isCompatible(item) || isInActiveSlot(item) || healthStore.loading || healthStore.busy || !!healthStore.error"
        :aria-label="tr('Health.equipNamed', { item: name })" @click.stop="pickItem(item)">
        {{ isInActiveSlot(item) ? tr('Health.equipped') : tr('Health.equip') }}
      </button>
    </div>
  </div>
</template>
