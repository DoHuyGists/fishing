<script setup lang="ts">
import type { EquipmentStatDisplay } from '../../types/model/equipment';

defineProps<{ title: string; description: string; stats: EquipmentStatDisplay[] }>();
</script>

<template>
  <section class="shared-equipment-stats rounded-xl border border-border-default bg-surface p-2 text-content" :aria-label="title">
    <div class="mb-2 text-xs font-bold">{{ title }}</div>
    <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
      <div v-for="stat in stats" :key="stat.id" class="min-w-0 rounded-lg border border-border-default bg-white p-2">
        <div class="text-xs font-semibold">{{ stat.label }}</div>
        <div class="my-1 flex flex-wrap items-baseline gap-1 tabular-nums">
          <output :aria-label="stat.label" class="break-words text-base font-bold">{{ stat.value }}</output>
        </div>
      </div>
    </div>
    <div class="mt-1 text-[10px] text-palette-526650">{{ description }}</div>
  </section>
</template>

<style scoped>
.ocean-theme .shared-equipment-stats output {
  color: var(--color-ocean-gold);
  text-shadow: 0 1px 2px #071a2d4d;
}
</style>
