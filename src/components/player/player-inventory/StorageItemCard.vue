<script setup lang="ts">
import { computed } from "vue";
import type { UserInventory } from "../../../types/model/userInventory";
import { useStorageStore } from "../../../stores/player-storage-store";
import { useInformationModal } from "../../../composables/useInformationModal";
import { getFormattingLocale, t as tr } from "../../../i18n";
import { healthEquipment } from "../../../data/healthEquipment";
import type { InformationModalField } from "../../../types/model/informationModal";
const props = defineProps<{ item: UserInventory }>();
const storage = useStorageStore();
const information = useInformationModal();
const protectedItem = computed(() => storage.protectedIds.has(props.item.id));
function showDetails() {
  const data = props.item.data;
  const stats: [string, string][] = [
    ['max_weight', 'InventoryItemCard.tai_trong_toi_da'], ['pull_strength', 'InventoryItemCard.suc_keo'],
    ['durability', 'InventoryItemCard.do_ben'], ['catch_rate', 'InventoryItemCard.bonus_moc_ca'], ['luck_bonus', 'InventoryItemCard.may_man'],
  ];
  const details: InformationModalField[] = [
    { label: tr('ShopModal.so_luong'), value: storage.quantity(props.item).toLocaleString(getFormattingLocale()) },
    ...stats.flatMap(([key, label]) => typeof data[key] === 'number' && Number.isFinite(data[key])
      ? [{ label: tr(label), value: data[key].toLocaleString(getFormattingLocale(), key === 'catch_rate'
        ? { style: 'percent', maximumFractionDigits: 2 } : { maximumFractionDigits: 2 }) + (key === 'max_weight' ? ' kg' : '') }] : []),
  ];
  for (const [key, value] of Object.entries(healthEquipment(props.item).bonuses)) {
    details.push({ label: tr(`Health.${key}`), value: `+${value?.toLocaleString(getFormattingLocale())}` });
  }
  const metadata: InformationModalField[] = [];
  if (Array.isArray(data.fish_type) && data.fish_type.length) metadata.push({ label: tr('InventoryItemCard.nhom_ca'), value: data.fish_type.join(', ') });
  const received = new Date(props.item.createdAt);
  if (Number.isFinite(received.getTime())) metadata.push({ label: tr('Storage.received'), value: received.toLocaleString(getFormattingLocale()) });
  metadata.push({ label: tr('InformationModal.itemId'), value: props.item.id });
  information.open({
    name: storage.itemName(props.item), image: data.image || undefined, icon: data.icon || undefined,
    description: data.information || data.detail || '',
    itemDetails: {
      badges: [storage.categoryLabel(data.category), storage.classificationLabel(data.classification),
        protectedItem.value ? tr('Storage.protected') : '', props.item.rpc?.trim() ? tr('Storage.usable') : ''].filter(Boolean),
      stats: details, metadata,
    },
  });
}
</script>

<template>
  <article class="player-content-in min-w-0 rounded-xl border bg-white p-3 text-content" :class="[
    storage.selectedIds.includes(item.id) ? 'border-accent ring-1 ring-accent' : 'border-border-default',
    storage.view === 'list' ? 'flex flex-wrap items-center gap-3' : 'flex flex-col gap-3',
  ]">
    <div class="flex items-start gap-3" :class="storage.view === 'list' ? 'min-w-0 flex-1' : ''">
      <input type="checkbox" :checked="storage.selectedIds.includes(item.id)" :disabled="storage.loading || storage.busy"
        :aria-label="tr('InventoryItems.chon_value0_de_xoa', { value0: storage.itemName(item) })" class="mt-1 size-4 shrink-0 accent-accent" @change="storage.toggleSelect(item.id)" />
      <div class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-xl">
        <img v-if="item.data.image" :src="item.data.image" :alt="storage.itemName(item)" loading="lazy" class="size-full object-contain" />
        <span v-else>{{ item.data.icon || storage.itemName(item).charAt(0) }}</span>
      </div>
      <div class="min-w-0 space-y-1">
        <div class="break-words text-sm font-semibold">{{ storage.itemName(item) }}</div>
        <div class="break-words text-xs">{{ storage.categoryLabel(item.data.category) }}</div>
        <div class="text-xs">{{ tr('ShopModal.so_luong') }}: <b>{{ storage.quantity(item) }}</b></div>
      </div>
    </div>
    <div class="flex flex-wrap gap-1 text-xs">
      <span v-if="protectedItem" class="rounded bg-surface px-2 py-1">{{ tr('Storage.protected') }}</span>
      <span v-if="item.rpc?.trim()" class="rounded bg-surface px-2 py-1">{{ tr('Storage.usable') }}</span>
    </div>
    <button type="button" class="mt-auto min-h-9 rounded-lg border border-border-default px-3 py-1 text-xs hover:bg-surface" @click="showDetails">{{ tr('InventoryItemCard.xem_chi_tiet') }}</button>
  </article>
</template>
