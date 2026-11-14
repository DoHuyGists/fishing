<script setup lang="ts">
import { getFormattingLocale, t as tr } from "../../../../i18n/index.ts";
import { useHealthStore } from "../../../../stores/health.ts";
import { computed } from "vue";
import EquipmentStatsOverview from "../../../shared/EquipmentStatsOverview.vue";

const store = useHealthStore();
const number = (value: number) => value.toLocaleString(getFormattingLocale(), { maximumFractionDigits: 1 });
const stats = computed(() =>
  store.stats.map((stat) => ({ id: stat.id, label: tr(`Health.${stat.id}`), value: number(stat.value) })),
);
</script>

<template>
  <EquipmentStatsOverview :title="tr('Health.title')" :description="tr('Health.activeSetTotals')" :stats="stats" />
</template>
