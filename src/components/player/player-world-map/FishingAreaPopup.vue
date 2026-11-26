<script setup lang="ts">
import { t as tr } from "../../../i18n";
import type { AreaPoint } from "../../../types/model/worldMap";
import FishingFatigue from "../player-fishing/FishingFatigue.vue";
import FishingModeBadge from "../../shared/FishingModeBadge.vue";

defineProps<{
  area: AreaPoint;
  previewScene: string;
  isEntering: boolean;
  enterAreaAvailable: boolean;
}>();

const emit = defineEmits<{
  close: [];
  enter: [];
}>();
</script>

<template>
  <div class="player-popup-in flex flex-col gap-1.5 rounded-lg bg-white p-2 text-xs text-content shadow-lg">
    <div class="flex items-center justify-between gap-2 font-bold">
      <span class="whitespace-nowrap">{{ area.title }}</span>
      <button type="button" class="text-base leading-none text-content" @click="emit('close')">
        ×
      </button>
    </div>
    <div class="overflow-hidden rounded-md">
      <img
        v-if="previewScene"
        :src="previewScene"
        class="w-full hover:scale-110 duration-200"
        draggable="false"
      />
    </div>
    <div class="flex gap-1">
      <FishingModeBadge :area="area" compacted />
      <FishingFatigue v-if="!area.survivalMode" variant="compact" :area-id="area.id" />
    </div>
    <button
      type="button"
      class="w-full rounded-lg bg-accent px-2 py-1.5 font-bold text-white hover:bg-accent disabled:opacity-70"
      :disabled="isEntering"
      :class="{ 'underline underline-offset-2': !enterAreaAvailable }"
      @click="emit('enter')"
    >
      {{
        !enterAreaAvailable
          ? tr("FeatureAvailability.maintenanceBadge")
          : isEntering
            ? tr("InteractWorldMap.dang_vao")
            : tr("InteractWorldMap.di_den_bai_cau")
      }}
    </button>
  </div>
</template>
