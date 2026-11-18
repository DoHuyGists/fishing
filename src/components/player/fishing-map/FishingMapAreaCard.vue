<script setup lang="ts">
import { t as tr } from '../../../i18n';
import type { FishingMapArea } from '../../../types/model/fishingMap';
defineProps<{ area: FishingMapArea; viewMode: 'list' | 'grid' }>();
</script>

<template>
  <article class="player-popup-in overflow-hidden rounded-xl border border-[#cbd9c6] bg-white" :class="viewMode === 'list' ? 'sm:flex' : ''">
    <div class="flex shrink-0 items-center justify-center overflow-hidden bg-[#e5eddf]" :class="viewMode === 'list' ? 'h-36 sm:h-auto sm:w-44' : 'h-40'">
      <img v-if="area.scenePath" :src="area.scenePath" alt="" loading="lazy" class="h-full w-full object-cover" />
      <img v-else src="/icons/check-point.svg" alt="" class="size-12 opacity-50" />
    </div>
    <div class="min-w-0 flex-1 p-4">
      <div class="break-words font-bold">{{ area.title || tr('FishingAnchor.bai_cau_chua_dat_ten') }}</div>
      <details v-if="area.species.length" class="mt-3" open>
        <summary class="cursor-pointer text-sm font-semibold">{{ tr('FishingMapModal.speciesCount', { count: area.species.length }) }}</summary>
        <div class="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
          <div v-for="species in area.species" :key="species.speciesId" class="flex items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1 text-xs">
            <img v-if="species.speciesImage" :src="species.speciesImage" alt="" loading="lazy" class="size-8 object-contain" />
            <span>{{ species.speciesName }}</span>
          </div>
        </div>
      </details>
      <div v-else class="mt-3 text-sm text-[#607176]">{{ tr('FishingMapModal.noSpecies') }}</div>
    </div>
  </article>
</template>
