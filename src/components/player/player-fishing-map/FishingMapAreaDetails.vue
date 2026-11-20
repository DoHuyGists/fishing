<script setup lang="ts">
import { t as tr, getFormattingLocale } from '../../../i18n';
import type { FishingMapArea } from '../../../types/model/fishingMap';
defineProps<{ area: FishingMapArea }>();
</script>

<template>
  <div class="mt-3 space-y-3 text-sm">
    <div class="grid grid-cols-2 gap-2">
      <div class="rounded-lg border border-border-default bg-surface p-2">
        <div class="text-xs text-palette-607176">{{ tr('FishingMapModal.region') }}</div>
        <div class="mt-1 break-words font-semibold">{{ area.zone?.name || tr('FishingMapModal.unknown') }}</div>
        <div v-if="area.zone" class="text-xs text-palette-607176">{{ area.zone.code }}</div>
      </div>
      <div class="rounded-lg border border-border-default bg-surface p-2">
        <div class="text-xs text-palette-607176">{{ tr('FishingMapModal.maxDepth') }}</div>
        <div class="mt-1 font-semibold">{{ area.maxDepth == null ? tr('FishingMapModal.unknown') : `${area.maxDepth.toLocaleString(getFormattingLocale())} m` }}</div>
      </div>
    </div>
    <div class="flex flex-wrap justify-between gap-2 text-xs">
      <span>{{ tr('FishingMapModal.depthTool') }}: {{ tr(area.allowDepthTool ? 'FishingMapModal.yes' : 'FishingMapModal.no') }}</span>
      <span v-if="area.timezone">{{ tr('FishingMapModal.timezone') }}: {{ area.timezone }}</span>
    </div>
    <div>
      <div class="mb-2 font-semibold">{{ tr('FishingMapModal.possibleWeathers') }}</div>
      <div v-if="area.zone?.weathers.length" class="grid grid-cols-2 gap-2">
        <div v-for="weather in area.zone.weathers" :key="weather.id" class="flex items-center gap-2 rounded-lg border border-border-default p-2">
          <img :src="weather.image || '/icons/weathers/cloudy.svg'" alt="" loading="lazy" class="size-8 shrink-0 object-contain" />
          <span class="min-w-0 break-words text-xs">{{ weather.name }}</span>
        </div>
      </div>
      <div v-else class="text-xs text-palette-607176">{{ tr('FishingMapModal.noWeathers') }}</div>
    </div>
  </div>
</template>
