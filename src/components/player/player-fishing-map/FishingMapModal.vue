<script setup lang="ts">
import { t as tr } from "../../../i18n/index.ts";
import Modal from "../../shared/Modal.vue";
import { onUnmounted, watch } from "vue";
import { useAuthStore } from "../../../stores/auth.ts";
import { useCountryStore } from "../../../stores/player-country-store.ts";
import { useFishingMapStore } from "../../../stores/player-fishing-map-store.ts";
import FishingMapCountries from "./FishingMapCountries.vue";
import FishingMapToolbar from "./FishingMapToolbar.vue";
import FishingMapAreaCard from "./FishingMapAreaCard.vue";
import Pagination from "../../shared/Pagination.vue";
import FishingMapSpeciesPopup from "./FishingMapSpeciesPopup.vue";

const store = useFishingMapStore();
const auth = useAuthStore();
const countries = useCountryStore();
let stopRefresh = () => {};
watch(
  () => auth.sessionGeneration,
  () => {
    stopRefresh();
    const request = store.request + 1;
    store.$reset();
    store.request = request;
    void store.load();
    stopRefresh = countries.watchUnlockedCountries(auth.user?.id ?? null);
  },
  { immediate: true },
);
watch(
  () => [store.selectedCountryId, store.canView],
  () => {
    void store.loadSpecies();
  },
);
watch(
  () => [store.search, store.speciesId, store.sort],
  () => {
    store.page = 1;
  },
);
watch(
  () => store.totalPages,
  (pages) => {
    store.page = Math.min(store.page, pages);
  },
);
onUnmounted(() => {
  stopRefresh();
  store.request++;
});

async function refresh() {
  await store.load(true);
  await store.loadSpecies();
}
</script>

<template>
  <Modal :title="tr('FishingMapModal.title')" :on-refresh="refresh">
    <div class="flex min-h-full flex-col gap-3 text-content md:flex-row">
      <FishingMapCountries />
      <section
        class="min-w-0 flex flex-col flex-1 rounded-xl border border-border-default bg-surface p-3 sm:p-4"
        :aria-label="tr('FishingMapModal.areas')"
        :aria-busy="store.loading || store.loadingSpecies"
      >
        <div v-if="store.loading" role="status" class="py-10 text-center">{{ tr("FishingMapModal.loading") }}</div>
        <div v-else-if="store.error || countries.unlockedError" role="alert" class="py-10 text-center">
          <div>{{ store.error || countries.unlockedError }}</div>
          <button type="button" class="mt-3 rounded-lg border border-border-default bg-white px-4 py-2" @click="refresh">
            {{ tr("Maintenance.thu_lai") }}
          </button>
        </div>
        <template v-else-if="store.canView">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div class="text-lg font-bold">{{ store.selectedCountry?.name }}</div>
            <span class="text-sm" aria-live="polite">{{
              tr("FishingMapModal.areaCount", { count: store.areas.length })
            }}</span>
          </div>
          <FishingMapToolbar />
          <div v-if="store.loadingSpecies" role="status" class="py-10 text-center">
            {{ tr("FishingMapModal.loading") }}
          </div>
          <div v-else-if="store.speciesError" role="alert" class="py-10 text-center">
            <div>{{ store.speciesError }}</div>
            <button
              type="button"
              class="mt-3 rounded-lg border border-border-default bg-white px-4 py-2"
              @click="store.loadSpecies()"
            >
              {{ tr("Maintenance.thu_lai") }}
            </button>
          </div>
          <template v-else>
            <div
              v-if="store.areas.length"
              class="mt-4 grid h-0 grow gap-3 overflow-y-scroll pr-1"
              :class="store.viewMode === 'grid' ? 'lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'"
            >
              <FishingMapAreaCard
                v-for="(area, index) in store.pagedAreas"
                :key="area.id"
                class="slide-fade-in from-bottom player-content-in"
                :style="{ '--delay': `${index * 45}ms` }"
                :area="area"
                :view-mode="store.viewMode"
              />
            </div>
            <div v-else role="status" class="py-10 text-center">{{ tr("FishingMapModal.noAreas") }}</div>
            <Pagination
              :page="store.page"
              :total="store.areas.length"
              :page-size="12"
              class="mt-4"
              @change="store.page = $event"
            />
          </template>
        </template>
        <div v-else role="status" class="py-10 text-center">{{ tr("FishingMapModal.selectCountry") }}</div>
      </section>
    </div>
  </Modal>
  <FishingMapSpeciesPopup />
</template>
