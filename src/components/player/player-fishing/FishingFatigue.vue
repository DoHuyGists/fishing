<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useFishingFatigueStore } from '../../../stores/player-fishing-fatigue-store';
import { useAuthStore } from '../../../stores/auth';
import { getFormattingLocale, t as tr } from '../../../i18n';

const props = withDefaults(defineProps<{
  areaId: string | null;
  presence?: boolean;
  variant?: 'default' | 'compact';
}>(), { presence: false, variant: 'default' });
const store = useFishingFatigueStore();
const auth = useAuthStore();
const key = computed(() => store.snapshotKey(props.areaId ?? '', props.presence));
const snapshot = computed(() => store.snapshots[key.value]);
const score = computed(() => Math.max(0, Math.min(100, snapshot.value?.fatigue_score ?? 0)));
const fatigueIcons = ['😀', '🙂', '😐', '😪', '😓', '🥵', '🤬', '💀'] as const;
const fatigueIcon = computed(() => fatigueIcons[Math.min(fatigueIcons.length - 1, Math.floor(score.value / (100 / fatigueIcons.length)))]);
const formatter = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 1 }));
const description = computed(() => {
  if (store.errors[key.value]) return tr('FishingFatigue.unavailable');
  if (!snapshot.value) return tr('FishingFatigue.loading');
  return `${tr('FishingFatigue.label')}: ${formatter.value.format(score.value)}/100`;
});
let timer: ReturnType<typeof setInterval> | undefined;
function refresh() {
  if (!props.areaId || navigator.onLine === false) return;
  void store.refresh(props.areaId, props.presence);
}
watch([() => props.areaId, () => props.presence, () => auth.user?.id, () => auth.sessionGeneration], () => {
  clearInterval(timer);
  if (props.areaId && auth.user?.id) {
    refresh();
    // Only the fishing view renews presence; previews never change it.
    timer = setInterval(refresh, 30_000);
  }
}, { immediate: true });
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <section
    v-if="areaId"
    class="slide-fade-in from-left player-content-in w-full rounded-lg border border-border-default bg-surface p-2 text-xs text-content"
    :aria-label="tr('FishingFatigue.label')"
    :aria-busy="!!store.loading[key]"
    :title="variant === 'compact' ? description : undefined"
  >
    <template v-if="snapshot || variant === 'compact'">
      <div v-if="variant !== 'compact'" class="font-semibold">{{ tr('FishingFatigue.label') }}: {{ formatter.format(score) }}/100</div>
      <div :class="variant === 'compact' ? 'flex items-center gap-2' : undefined">
        <span v-if="variant === 'compact'" aria-hidden="true" class="shrink-0 text-base leading-none">{{ store.errors[key] ? '⚠️' : fatigueIcon }}</span>
        <div
          role="progressbar"
          :aria-label="tr('FishingFatigue.label')"
          :aria-valuenow="snapshot ? score : undefined"
          :aria-valuetext="description"
          :aria-valuemin="0"
          :aria-valuemax="100"
          class="h-2.5 overflow-hidden rounded-full bg-palette-dce8d5"
          :class="variant === 'compact' ? 'min-w-0 flex-1' : 'my-2'"
        >
          <div
            v-if="snapshot"
            class="h-full rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none"
            :class="score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-amber-500' : 'bg-emerald-600'"
            :style="{ width: `${score}%` }"
          />
        </div>
      </div>
      <template v-if="snapshot && variant !== 'compact'">
        <div class="flex justify-between text-[10px] text-content-muted">
          <span>{{ tr('FishingFatigue.rested') }}</span>
          <span>{{ tr('FishingFatigue.exhausted') }}</span>
        </div>
        <div class="mt-2 border-t border-border-default pt-2">
          <div class="mb-1 font-semibold">{{ tr('FishingFatigue.effects') }}</div>
          <div v-if="!snapshot.effects.length" class="text-content-muted">{{ tr('FishingFatigue.noEffects') }}</div>
          <div v-for="(effect, index) in snapshot.effects" :key="`${effect.code}:${effect.target}:${index}`" class="flex justify-between gap-2 text-content-muted">
            <span>{{ tr(`FishingFatigue.${effect.target}`) }}</span>
            <span class="shrink-0 font-semibold text-red-700">{{ formatter.format(effect.value) }}%</span>
          </div>
        </div>
        <div class="mt-2 text-[10px] leading-relaxed text-content-muted">{{ tr('FishingFatigue.recovery') }}</div>
      </template>
    </template>
    <div v-else-if="!store.errors[key]" role="status">{{ tr('FishingFatigue.loading') }}</div>
    <div v-if="variant === 'compact' && !snapshot && !store.errors[key]" role="status" class="sr-only">{{ tr('FishingFatigue.loading') }}</div>
    <div v-if="store.errors[key]" role="status" :class="variant === 'compact' ? 'sr-only' : 'mt-1 text-amber-800'">{{ tr('FishingFatigue.unavailable') }}</div>
  </section>
</template>
