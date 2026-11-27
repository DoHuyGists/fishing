<script setup lang="ts">
import { t as tr, getFormattingLocale } from '../../../i18n';
import type { FishingMapArea } from '../../../types/model/fishingMap';
defineProps<{ area: FishingMapArea; compact?: boolean }>();
</script>

<template>
  <div class="text-sm" :class="compact ? 'mt-2 space-y-2' : 'mt-3 space-y-3'">
    <div :class="compact ? 'flex flex-wrap gap-x-4 gap-y-1 text-xs' : 'grid grid-cols-2 gap-2'">
      <div class="min-w-0" :class="compact ? 'flex flex-wrap items-baseline gap-x-1' : 'rounded-lg border border-border-default bg-surface p-2'">
        <div class="text-xs text-content">{{ tr('FishingMapModal.region') }}<span v-if="compact">:</span></div>
        <div class="break-words font-semibold" :class="compact ? '' : 'mt-1'">{{ area.zone?.name || tr('FishingMapModal.unknown') }}</div>
        <div v-if="area.zone" class="text-xs text-content">{{ compact ? `(${area.zone.code})` : area.zone.code }}</div>
      </div>
      <div class="min-w-0" :class="compact ? 'flex items-baseline gap-1' : 'rounded-lg border border-border-default bg-surface p-2'">
        <div class="text-xs text-content">{{ tr('FishingMapModal.maxDepth') }}<span v-if="compact">:</span></div>
        <div class="font-semibold" :class="compact ? '' : 'mt-1'">{{ area.maxDepth == null ? tr('FishingMapModal.unknown') : `${area.maxDepth.toLocaleString(getFormattingLocale())} m` }}</div>
      </div>
    </div>
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs" :class="compact ? '' : 'justify-between'">
      <span>{{ tr('FishingMapModal.depthTool') }}: {{ tr(area.allowDepthTool ? 'FishingMapModal.yes' : 'FishingMapModal.no') }}</span>
      <span v-if="area.timezone" class="min-w-0 wrap-anywhere">{{ tr('FishingMapModal.timezone') }}: {{ area.timezone }}</span>
    </div>
    <div :class="compact ? 'flex flex-wrap items-center gap-x-2 gap-y-1' : ''">
      <div class="font-semibold" :class="compact ? 'text-xs' : 'mb-2'">{{ tr('FishingMapModal.possibleWeathers') }}</div>
      <div v-if="area.zone?.weathers.length" :class="compact ? 'flex flex-wrap gap-1' : 'grid grid-cols-2 gap-2'">
        <div v-for="weather in area.zone.weathers" :key="weather.id" class="flex items-center rounded-lg border border-border-default" :class="compact ? 'gap-1 px-2 py-1' : 'gap-2 p-2'">
          <img :src="weather.image || '/icons/weathers/cloudy.svg'" alt="" loading="lazy" class="shrink-0 object-contain" :class="compact ? 'size-5' : 'size-8'" />
          <span class="min-w-0 break-words text-xs">{{ weather.name }}</span>
        </div>
      </div>
      <div v-else class="text-xs text-content">{{ tr('FishingMapModal.noWeathers') }}</div>
    </div>
  </div>
</template>
