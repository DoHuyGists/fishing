<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { useDayPhaseStore } from "../../../stores/player-day-phase-store.ts";
import WeatherSection from "./WeatherSection.vue";

defineProps<{ compact?: boolean; expanded?: boolean }>();

const dayPhaseStore = useDayPhaseStore();
</script>

<template>
  <section
    class="flex min-w-0 gap-2 text-content"
    :class="compact ? '' : 'slide-fade-in from-top player-content-in rounded-xl border border-border-default bg-surface p-2 shadow-sm'"
    :aria-label="tr('DayPhaseClock.thoi_gian_va_thoi_tiet')"
  >
    <div v-if="!compact && dayPhaseStore.currentPhase" class="w-20">
      <img :src="dayPhaseStore.currentPhase.icon" class="rounded-md" :alt="dayPhaseStore.currentPhase.label" />
    </div>
    <div class="min-w-0" :class="{ 'flex-1': compact }">
      <div class="flex items-center justify-between gap-2">
        <time
          class="text-content [font-variant-numeric:tabular-nums] font-[750] leading-none whitespace-nowrap"
          :class="compact ? 'text-sm' : 'text-lg'"
          :title="dayPhaseStore.currentPhase?.label ?? tr('DayPhaseClock.mui_gio_khong_hop_le')"
          >{{ dayPhaseStore.timeLabel || "—" }}</time
        >
        <WeatherSection v-if="compact" compact />
      </div>
      <div v-if="!compact || expanded" class="mt-1.5 flex items-center gap-1.5">
        <span
          class="h-1.5 w-1.5 shrink-0 rounded-full bg-gold shadow-[0_0_8px_color-mix(in_srgb,_var(--color-gold)_70%,_transparent)]"
          aria-hidden="true"
        ></span>
        <span class="overflow-hidden text-content text-[11px] font-semibold text-ellipsis whitespace-nowrap">{{
          dayPhaseStore.currentPhase?.label ?? tr("DayPhaseClock.mui_gio_khong_hop_le")
        }}</span>
      </div>
      <div v-if="(!compact || expanded) && dayPhaseStore.fishTimeBucket" class="mt-1 text-[11px] text-content">
        {{ tr(dayPhaseStore.fishTimeBucket === "DAY" ? "DayPhaseClock.ca_ban_ngay" : "DayPhaseClock.ca_ban_dem") }}
      </div>
      <div v-if="!compact" class="mt-[9px]">
        <WeatherSection />
      </div>
    </div>
  </section>
</template>
