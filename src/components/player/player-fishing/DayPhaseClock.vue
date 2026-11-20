<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { useDayPhaseStore } from "../../../stores/player-day-phase-store.ts";
import WeatherSection from "./WeatherSection.vue";

defineProps<{ areaId: string | null | undefined }>();

const dayPhaseStore = useDayPhaseStore();
</script>

<template>
  <section
    class="slide-fade-in from-top player-content-in flex gap-2 rounded-xl border border-border-default bg-surface p-2 text-content shadow-sm"
    :aria-label="tr('DayPhaseClock.thoi_gian_va_thoi_tiet')"
  >
    <div v-if="dayPhaseStore.currentPhase" class="w-20">
      <img :src="dayPhaseStore.currentPhase.icon" class="rounded-md" :alt="dayPhaseStore.currentPhase.label" />
    </div>
    <div class="min-w-0">
      <div class="flex items-baseline justify-between gap-2">
        <time
          class="text-content text-lg [font-variant-numeric:tabular-nums] font-[750] leading-none whitespace-nowrap"
          >{{ dayPhaseStore.timeLabel || "—" }}</time
        >
      </div>
      <div class="mt-1.5 flex items-center gap-1.5">
        <span
          class="h-1.5 w-1.5 shrink-0 rounded-full bg-gold shadow-[0_0_8px_color-mix(in_srgb,_var(--color-gold)_70%,_transparent)]"
          aria-hidden="true"
        ></span>
        <span class="overflow-hidden text-content text-[11px] font-semibold text-ellipsis whitespace-nowrap">{{
          dayPhaseStore.currentPhase?.label ?? tr("DayPhaseClock.mui_gio_khong_hop_le")
        }}</span>
      </div>
      <div v-if="dayPhaseStore.fishTimeBucket" class="mt-1 text-[11px] text-content">
        {{ tr(dayPhaseStore.fishTimeBucket === "DAY" ? "DayPhaseClock.ca_ban_ngay" : "DayPhaseClock.ca_ban_dem") }}
      </div>
      <div class="mt-[9px]">
        <WeatherSection :area-id="areaId" />
      </div>
    </div>
  </section>
</template>
