<script setup lang="ts">
import { computed } from 'vue';
import { getFormattingLocale, t as tr } from '../../../i18n';
import { useHealthStore } from '../../../stores/player-health-store';

defineProps<{ preview?: boolean }>();
const health = useHealthStore();
const number = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 2 }));
</script>

<template>
  <section class="slide-fade-in from-left player-content-in rounded-lg border border-danger/40 bg-surface p-2 text-xs text-content" :aria-label="tr('FishingSurvival.title')">
    <div class="font-semibold text-danger">{{ tr('FishingSurvival.title') }}</div>
    <div v-if="!preview" class="mt-2 grid gap-1.5">
      <div v-for="stat in health.stats" :key="stat.id" class="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-2">
        <span>{{ tr(`Health.${stat.id}`) }}</span>
        <div
          role="progressbar"
          :aria-label="tr(`Health.${stat.id}`)"
          :aria-valuenow="stat.value"
          :aria-valuemin="0"
          :aria-valuemax="health.maximums[stat.id] || 1"
          class="h-1.5 overflow-hidden rounded-full bg-accent/15"
        >
          <div
            class="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
            :class="stat.id === 'vitality' ? 'bg-danger' : 'bg-accent'"
            :style="{ width: `${health.maximums[stat.id] ? stat.value / health.maximums[stat.id] * 100 : 0}%` }"
          />
        </div>
        <span class="text-right tabular-nums">{{ number.format(stat.value) }}/{{ number.format(health.maximums[stat.id]) }}</span>
      </div>
    </div>
    <div class="mt-2 leading-relaxed">{{ tr('FishingSurvival.rules') }}</div>
  </section>
</template>
