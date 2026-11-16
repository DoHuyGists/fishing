<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useFishingFatigueStore } from '../../../stores/fishingFatigue';
import { useAuthStore } from '../../../stores/auth';
import { getFormattingLocale, t as tr } from '../../../i18n';

const props = withDefaults(defineProps<{ areaId: string | null; presence?: boolean }>(), { presence: false });
const store = useFishingFatigueStore();
const auth = useAuthStore();
const key = computed(() => store.snapshotKey(props.areaId ?? '', props.presence));
const snapshot = computed(() => store.snapshots[key.value]);
const score = computed(() => Math.max(0, Math.min(100, snapshot.value?.fatigue_score ?? 0)));
const formatter = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 1 }));
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
    class="slide-fade-in from-left player-content-in w-full rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-2 text-xs text-[#24352a]"
    :aria-label="tr('FishingFatigue.label')"
    :aria-busy="!!store.loading[key]"
  >
    <template v-if="snapshot">
      <div class="font-semibold">{{ tr('FishingFatigue.label') }}: {{ formatter.format(score) }}/100</div>
      <div
        role="progressbar"
        :aria-label="tr('FishingFatigue.label')"
        :aria-valuenow="score"
        :aria-valuemin="0"
        :aria-valuemax="100"
        class="my-2 h-2.5 overflow-hidden rounded-full bg-[#dce8d5]"
      >
        <div
          class="h-full rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none"
          :class="score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-amber-500' : 'bg-emerald-600'"
          :style="{ width: `${score}%` }"
        />
      </div>
      <div class="flex justify-between text-[10px] text-[#52654f]">
        <span>{{ tr('FishingFatigue.rested') }}</span>
        <span>{{ tr('FishingFatigue.exhausted') }}</span>
      </div>
      <div class="mt-2 border-t border-[#cbd9c6] pt-2">
        <div class="mb-1 font-semibold">{{ tr('FishingFatigue.effects') }}</div>
        <div v-if="!snapshot.effects.length" class="text-[#52654f]">{{ tr('FishingFatigue.noEffects') }}</div>
        <div v-for="(effect, index) in snapshot.effects" :key="`${effect.code}:${effect.target}:${index}`" class="flex justify-between gap-2 text-[#52654f]">
          <span>{{ tr(`FishingFatigue.${effect.target}`) }}</span>
          <span class="shrink-0 font-semibold text-red-700">{{ formatter.format(effect.value) }}%</span>
        </div>
      </div>
      <div class="mt-2 text-[10px] leading-relaxed text-[#52654f]">{{ tr('FishingFatigue.recovery') }}</div>
    </template>
    <div v-else-if="!store.errors[key]" role="status">{{ tr('FishingFatigue.loading') }}</div>
    <div v-if="store.errors[key]" role="status" class="mt-1 text-amber-800">{{ tr('FishingFatigue.unavailable') }}</div>
  </section>
</template>
