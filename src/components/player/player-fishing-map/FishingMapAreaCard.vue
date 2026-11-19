<script setup lang="ts">
import { t as tr } from "../../../i18n";
import type { FishingMapArea } from "../../../types/model/fishingMap";
import { useFishingMapStore } from "../../../stores/player-fishing-map-store.ts";
import FishingMapAreaDetails from "./FishingMapAreaDetails.vue";
const store = useFishingMapStore();
defineProps<{ area: FishingMapArea; viewMode: "list" | "grid" }>();
</script>

<template>
  <article
    class="player-popup-in rounded-xl border border-[#cbd9c6] bg-white overflow-hidden"
    :class="viewMode === 'list' ? 'sm:flex' : ''"
  >
    <div
      class="flex shrink-0 items-center justify-center overflow-hidden bg-[#e5eddf]"
      :class="viewMode === 'list' ? 'h-36 sm:h-auto sm:w-1/3' : 'h-40'"
    >
      <img
        v-if="area.scenePath"
        :src="area.scenePath + '/day.png'"
        alt=""
        loading="lazy"
        class="h-full w-full object-cover"
      />
      <img v-else src="/icons/check-point.svg" alt="" class="size-12 opacity-50" />
    </div>
    <div class="min-w-0 flex-1 p-4">
      <div class="break-words font-bold">{{ area.title || tr("FishingAnchor.bai_cau_chua_dat_ten") }}</div>
      <div
        class="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold"
        :class="area.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'"
      >
        <span aria-hidden="true">●</span>{{ tr(area.isAvailable ? "FishingMapModal.open" : "FishingMapModal.closed") }}
      </div>
      <FishingMapAreaDetails :area="area" />
      <details v-if="area.species.length" class="mt-3" open>
        <summary class="cursor-pointer text-sm font-semibold">
          {{ tr("FishingMapModal.speciesCount", { count: area.species.length }) }}
        </summary>
        <div class="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
          <button
            v-for="species in area.species"
            :key="species.speciesId"
            type="button"
            class="flex items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1 text-left text-xs transition-colors hover:bg-[#e5eddf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            aria-haspopup="dialog"
            @click="store.selectedSpecies = species"
          >
            <img
              v-if="species.speciesImage"
              :src="species.speciesImage"
              alt=""
              loading="lazy"
              class="size-8 object-contain"
            />
            <span>{{ species.speciesName }}</span>
          </button>
        </div>
      </details>
      <div v-else class="mt-3 text-sm text-[#607176]">{{ tr("FishingMapModal.noSpecies") }}</div>
    </div>
  </article>
</template>
