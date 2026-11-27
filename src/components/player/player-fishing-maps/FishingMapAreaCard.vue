<script setup lang="ts">
import { t as tr } from "../../../i18n/index.ts";
import type { FishingMapArea } from "../../../types/model/fishingMap.ts";
import { useFishingMapStore } from "../../../stores/player-fishing-map-store.ts";
import FishingMapAreaDetails from "./FishingMapAreaDetails.vue";
import FishingModeBadge from "../../shared/FishingModeBadge.vue";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useModalStore } from "../../../stores/player-modal-store.ts";
const store = useFishingMapStore();
const props = defineProps<{ area: FishingMapArea; viewMode: "list" | "grid" }>();
const router = useRouter();
const modal = useModalStore();
const navigating = ref(false);

async function openPrepare() {
  if (!props.area.isAvailable || navigating.value) return;
  navigating.value = true;
  try {
    await router.push({ name: "prepare", params: { areaId: props.area.id } });
    if (router.currentRoute.value.name === "prepare" && router.currentRoute.value.params.areaId === props.area.id) {
      modal.close();
    }
  } finally {
    navigating.value = false;
  }
}
</script>

<template>
  <article
    class="player-popup-in min-w-0 rounded-xl border border-border-default bg-white"
    :class="viewMode === 'list' ? 'sm:flex' : ''"
  >
    <div
      class="flex shrink-0 items-center justify-center overflow-hidden rounded-t-xl bg-surface"
      :class="
        viewMode === 'list'
          ? 'h-28 sm:h-24 sm:w-40 sm:self-start sm:rounded-tr-none sm:rounded-bl-xl'
          : 'aspect-video'
      "
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
    <div class="min-w-0 flex-1" :class="viewMode === 'list' ? 'p-3' : 'p-4'">
      <div :class="viewMode === 'list' ? 'flex flex-wrap items-center gap-x-3 gap-y-1' : ''">
        <div class="break-words font-bold">{{ area.title || tr("FishingAnchor.bai_cau_chua_dat_ten") }}</div>
        <div class="flex flex-wrap items-center gap-2" :class="viewMode === 'grid' ? 'mt-2' : ''">
          <div
            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold text-white shadow-sm"
            :class="area.isAvailable ? 'border-accent bg-accent' : 'border-danger bg-danger'"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5 shrink-0">
              <path :d="area.isAvailable ? 'm3 8 3 3 7-7' : 'm4 4 8 8M12 4l-8 8'" />
            </svg>
            {{ tr(area.isAvailable ? "FishingMapModal.open" : "FishingMapModal.closed") }}
          </div>
          <FishingModeBadge :area="area" />
        </div>
      </div>
      <FishingMapAreaDetails :area="area" :compact="viewMode === 'list'" />
      <details v-if="area.species.length" :class="viewMode === 'list' ? 'mt-2' : 'mt-3'" open>
        <summary class="cursor-pointer text-sm font-semibold">
          {{ tr("FishingMapModal.speciesCount", { count: area.species.length }) }}
        </summary>
        <div class="mt-2 flex max-h-48 flex-wrap overflow-y-auto" :class="viewMode === 'list' ? 'gap-1' : 'gap-2'">
          <button
            v-for="species in area.species"
            :key="species.speciesId"
            type="button"
            class="flex items-center gap-2 rounded-lg border border-border-default bg-surface px-2 py-1 text-left text-xs transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-haspopup="dialog"
            @click="store.selectedSpecies = species"
          >
            <img
              v-if="species.speciesImage"
              :src="species.speciesImage"
              alt=""
              loading="lazy"
              class="object-contain"
              :class="viewMode === 'list' ? 'size-5' : 'size-8'"
            />
            <span>{{ species.speciesName }}</span>
          </button>
        </div>
      </details>
      <div v-else class="mt-3 text-sm text-content">{{ tr("FishingMapModal.noSpecies") }}</div>
      <div v-if="area.isAvailable" class="mt-3 flex justify-end">
        <button
          type="button"
          class="fishing-map-prepare inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70"
          :disabled="navigating"
          :aria-busy="navigating"
          @click="openPrepare"
        >
          {{ tr("InteractWorldMap.di_den_bai_cau") }}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  </article>
</template>
