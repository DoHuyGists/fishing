<script setup lang="ts">
import { t as tr } from '../../../i18n';
import type { DispatchStats } from '../../../types/table/dispatch';

defineProps<{ stats?: DispatchStats; requirements?: boolean }>();
const labels: Record<string, string> = {
  strength: 'Dispatch.strength', navigation: 'Dispatch.navigation', perception: 'Dispatch.perception',
};
</script>

<template>
  <div v-if="Object.keys(stats ?? {}).length" class="grid grid-cols-3 gap-2">
    <div v-for="(value, key) in stats" :key="key" class="min-w-0 rounded-lg bg-surface px-2 py-2.5 text-center">
      <div class="text-xs">{{ labels[key] ? tr(labels[key]) : key }}</div>
      <div class="mt-1 font-bold tabular-nums">{{ requirements ? '≥ ' : '' }}{{ value }}</div>
    </div>
  </div>
</template>
