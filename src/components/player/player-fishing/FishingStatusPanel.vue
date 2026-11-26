<script setup lang="ts">
import { ref, useId } from "vue";
import { t as tr } from "../../../i18n";
import type { FishingAreaRow } from "../../../types/table/fishingArea";
import FishingModeBadge from "../../shared/FishingModeBadge.vue";
import DayPhaseClock from "./DayPhaseClock.vue";
import FishingFatigue from "./FishingFatigue.vue";
import FishingSurvival from "./FishingSurvival.vue";

defineProps<{
  area: Pick<FishingAreaRow, "allowDepthTool" | "survivalMode">;
  areaId: string | null;
  leaving: boolean;
}>();
defineEmits<{ exit: [] }>();

const expanded = ref(false);
const contentId = useId();
</script>

<template>
  <section
    class="slide-fade-in from-top player-content-in w-[min(18rem,calc(100vw-7rem))] rounded-xl border border-border-default bg-surface/95 p-2 text-content shadow-sm backdrop-blur-md"
    :aria-label="tr('FishingView.trang_thai_cau_ca')"
  >
    <div class="flex items-center justify-between gap-1">
      <FishingModeBadge :area="area" />
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent"
          :aria-expanded="expanded"
          :aria-controls="contentId"
          :aria-label="tr(expanded ? 'FishingView.thu_gon_thong_tin' : 'FishingView.xem_thong_tin_chuyen_cau')"
          :title="tr(expanded ? 'FishingView.thu_gon_thong_tin' : 'FishingView.xem_thong_tin_chuyen_cau')"
          @click="expanded = !expanded"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            class="size-4 transition-transform motion-reduce:transition-none"
            :class="{ 'rotate-180': expanded }"
          >
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </button>
        <button
          type="button"
          class="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-danger/30 text-danger transition-colors hover:bg-danger hover:text-white focus-visible:outline-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-50"
          :disabled="leaving"
          :aria-busy="leaving"
          :aria-label="tr(leaving ? 'FishingView.dang_quay_lai' : 'FishingView.ket_thuc_chuyen_cau')"
          :title="tr(leaving ? 'FishingView.dang_quay_lai' : 'FishingView.ket_thuc_chuyen_cau')"
          @click="$emit('exit')"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
            <path d="M8 3H4v14h4M8 10h9m-4-4 4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>
    <div
      :id="contentId"
      class="mt-1 grid min-w-0 gap-2"
      :class="{ 'max-h-[min(60dvh,calc(100dvh-7rem))] touch-auto overflow-y-auto overscroll-contain': expanded }"
    >
      <DayPhaseClock compact :expanded="expanded" />
      <FishingSurvival v-if="area.survivalMode" :compact="!expanded" embedded />
      <FishingFatigue v-else :variant="expanded ? 'default' : 'compact'" :area-id="areaId" presence embedded />
    </div>
  </section>
</template>
