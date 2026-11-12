<script setup lang="ts">
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useDayPhaseStore } from "../../../stores/dayPhase.ts";
import WeatherSection from "./WeatherSection.vue";

defineProps<{ areaId: string | null | undefined }>();

const dayPhaseStore = useDayPhaseStore();
const now = ref(new Date());
let clockTimer: number | undefined;

const timeLabel = computed(() =>
  now.value.toLocaleTimeString(getFormattingLocale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
);

onMounted(() => {
  clockTimer = window.setInterval(() => (now.value = new Date()), 1000);
});

onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer);
});
</script>

<template>
  <section class="slide-fade-in from-top player-content-in flex" :aria-label="tr('DayPhaseClock.thoi_gian_va_thoi_tiet')">
    <div class="w-20">
      <img :src="dayPhaseStore.currentPhase.icon" :alt="dayPhaseStore.currentPhase.label" />
    </div>
    <div class="min-w-0">
      <div class="flex items-baseline justify-between gap-2">
        <time class="text-[#fff1c8] text-lg [font-variant-numeric:tabular-nums] font-[750] leading-none whitespace-nowrap">{{ timeLabel }}</time>
      </div>
      <div class="mt-1.5 flex items-center gap-1.5">
        <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-[#edc46f] shadow-[0_0_8px_rgba(237,196,111,0.7)]" aria-hidden="true"></span>
        <span class="overflow-hidden text-[#e1ebdf] text-[11px] font-semibold text-ellipsis whitespace-nowrap">{{ dayPhaseStore.currentPhase.label }}</span>
      </div>
      <div class="mt-[9px]">
        <WeatherSection :area-id="areaId" />
      </div>
    </div>
  </section>
</template>
