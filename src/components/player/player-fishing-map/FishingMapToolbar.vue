<script setup lang="ts">
import { t as tr } from "../../../i18n";
import { useFishingMapStore } from "../../../stores/player-fishing-map-store";
const store = useFishingMapStore();
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <input
      v-model="store.search"
      type="search"
      class="min-w-40 flex-1 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"
      :aria-label="tr('FishingMapModal.search')"
      :placeholder="tr('FishingMapModal.search')"
    />
    <select
      v-model="store.speciesId"
      :disabled="store.loadingSpecies"
      class="max-w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"
      :aria-label="tr('FishingMapModal.speciesFilter')"
    >
      <option value="">{{ tr("FishingMapModal.allSpecies") }}</option>
      <option v-for="species in store.speciesOptions" :key="species.id" :value="species.id">{{ species.name }}</option>
    </select>
    <select
      v-model="store.sort"
      class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"
      :aria-label="tr('FishingMapModal.sort')"
    >
      <option value="name">{{ tr("FishingMapModal.sortName") }}</option>
      <option value="species">{{ tr("FishingMapModal.sortSpecies") }}</option>
    </select>
    <div class="flex gap-1" role="group" :aria-label="tr('FishingMapModal.viewMode')">
      <button
        v-for="mode in ['list', 'grid'] as const"
        :key="mode"
        type="button"
        class="rounded-lg border border-[#cbd9c6] px-3 py-2 text-sm"
        :class="store.viewMode === mode ? 'bg-[#dce9d4] font-bold' : 'bg-white'"
        :aria-pressed="store.viewMode === mode"
        @click="store.viewMode = mode"
      >
        {{ tr(`FishingMapModal.${mode}`) }}
      </button>
    </div>
    <button
      v-if="store.search || store.speciesId || store.sort !== 'name'"
      type="button"
      class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"
      @click="
        store.search = '';
        store.speciesId = '';
        store.sort = 'name';
      "
    >
      {{ tr("FishingMapModal.clearFilters") }}
    </button>
  </div>
</template>
