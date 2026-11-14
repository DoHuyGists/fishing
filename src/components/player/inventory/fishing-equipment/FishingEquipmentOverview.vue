<script setup lang="ts">
import { computed } from "vue";
import { getFormattingLocale, t as tr } from "../../../../i18n/index.ts";
import { useInventoryStore } from "../../../../stores/inventory.ts";
import EquipmentStatsOverview from "../../../shared/EquipmentStatsOverview.vue";

const inventory = useInventoryStore();
const stats = computed(() => {
  const totals = inventory.activeFishingStats;
  const number = (value: number, percent = false) =>
    value.toLocaleString(getFormattingLocale(), { style: percent ? "percent" : "decimal", maximumFractionDigits: 2 });
  return [
    { id: "max_weight", label: tr("InventoryItemCard.tai_trong_toi_da"), value: `${number(totals.max_weight)} kg` },
    { id: "pull_strength", label: tr("InventoryItemCard.suc_keo"), value: number(totals.pull_strength) },
    { id: "durability", label: tr("InventoryItemCard.do_ben"), value: number(totals.durability) },
    { id: "catch_rate", label: tr("InventoryItemCard.bonus_moc_ca"), value: number(totals.catch_rate, true) },
    { id: "luck_bonus", label: tr("InventoryItemCard.may_man"), value: number(totals.luck_bonus) },
  ];
});
</script>

<template>
  <EquipmentStatsOverview
    :title="tr('EquipmentSets.statsTitle')"
    :description="tr('EquipmentSets.statsDescription')"
    :stats="stats"
  />
</template>
