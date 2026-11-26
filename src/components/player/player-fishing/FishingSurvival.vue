<script setup lang="ts">
import { computed } from 'vue';
import { getFormattingLocale, t as tr } from '../../../i18n';
import { useHealthStore } from '../../../stores/player-health-store';
import type { SurvivalResource } from '../../../types/model/health';

defineProps<{ preview?: boolean; compact?: boolean; embedded?: boolean }>();
const health = useHealthStore();
const number = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 2 }));
const icons: Record<SurvivalResource, string> = {
  vitality: '❤️', hydration: '💧', nutrition: '🍖', energy: '⚡', morale: '😊',
};
</script>

<template>
  <section
    class="text-xs text-content"
    :class="embedded ? '' : 'slide-fade-in from-left player-content-in rounded-lg border border-danger/40 bg-surface p-2'"
    :aria-label="tr('FishingSurvival.title')"
  >
    <div v-if="!compact" class="font-semibold text-danger">{{ tr('FishingSurvival.title') }}</div>
    <div v-if="!preview" class="grid gap-1.5" :class="compact ? 'grid-cols-5' : 'mt-2'">
      <div
        v-for="stat in health.stats"
        :key="stat.id"
        class="min-w-0"
        :class="compact ? 'flex flex-col gap-1 text-center' : 'grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-2'"
        :title="`${tr(`Health.${stat.id}`)}: ${number.format(stat.value)}/${number.format(health.maximums[stat.id])}`"
      >
        <span v-if="compact" aria-hidden="true" class="text-sm leading-none">{{ icons[stat.id] }}</span>
        <span v-else>{{ tr(`Health.${stat.id}`) }}</span>
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
        <span class="truncate tabular-nums" :class="compact ? 'text-[10px]' : 'text-right'">{{ number.format(stat.value) }}<template v-if="!compact">/{{ number.format(health.maximums[stat.id]) }}</template></span>
      </div>
    </div>
    <div v-if="!compact" class="mt-2 leading-relaxed">{{ tr('FishingSurvival.rules') }}</div>
  </section>
</template>
