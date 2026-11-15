<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useFishingFatigueStore } from '../../../stores/fishingFatigue';
import { useAuthStore } from '../../../stores/auth';
import { getFormattingLocale, t as tr } from '../../../i18n';

const props = defineProps<{ areaId: string | null }>();
const store = useFishingFatigueStore();
const auth = useAuthStore();
const formatter = computed(() => new Intl.NumberFormat(getFormattingLocale(), { maximumFractionDigits: 1 }));
let timer: ReturnType<typeof setInterval> | undefined;
let pending = false;
async function refresh() {
  if (!props.areaId || pending || navigator.onLine === false) return;
  pending = true;
  try { await store.refresh(props.areaId); } finally { pending = false; }
}
watch([() => props.areaId, () => auth.user?.id], () => {
  clearInterval(timer);
  store.reset();
  if (props.areaId) {
    void refresh();
    // Presence continues in a background tab. Offline clients expire on server.
    timer = setInterval(() => { void refresh(); }, 30_000);
  }
}, { immediate: true });
onBeforeUnmount(() => { clearInterval(timer); store.reset(); });
</script>

<template>
  <div class="slide-fade-in from-left player-content-in max-w-60 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1 text-xs text-[#24352a]" role="status">
    <div v-if="store.snapshot" class="font-semibold">{{ tr('FishingFatigue.label') }}: {{ formatter.format(store.snapshot.fatigue_score) }}/100</div>
    <div v-if="store.error">{{ store.error }}</div>
    <template v-if="store.snapshot">
      <div v-for="effect in store.snapshot.effects" :key="effect.code + effect.target" class="text-[#52654f]">
        {{ tr(`FishingFatigue.${effect.target}`) }}: {{ formatter.format(effect.value) }}%
      </div>
      <div class="text-[10px] text-[#52654f]">{{ tr('FishingFatigue.recovery') }}</div>
    </template>
  </div>
</template>
