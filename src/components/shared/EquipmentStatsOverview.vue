<script setup lang="ts">
import type { EquipmentStatDisplay } from '../../types/model/equipment';

defineProps<{ title: string; description: string; stats: EquipmentStatDisplay[] }>();
</script>

<template>
  <section class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-2 text-[#24352a]" :aria-label="title">
    <div class="mb-2 text-xs font-bold">{{ title }}</div>
    <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
      <div v-for="stat in stats" :key="stat.id" class="min-w-0 rounded-lg border border-[#cbd9c6] bg-white p-2">
        <div class="text-xs font-semibold">{{ stat.label }}</div>
        <div class="my-1 flex flex-wrap items-baseline gap-1 tabular-nums">
          <output :aria-label="stat.label" class="break-words text-base font-bold">{{ stat.value }}</output>
        </div>
      </div>
    </div>
    <div class="mt-1 text-[10px] text-[#526650]">{{ description }}</div>
  </section>
</template>
