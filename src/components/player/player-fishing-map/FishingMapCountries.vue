<script setup lang="ts">
import { t as tr } from "../../../i18n";
import { useFishingMapStore } from "../../../stores/player-fishing-map-store";
const store = useFishingMapStore();
</script>

<template>
  <aside class="flex min-h-0 min-w-0 shrink-0 flex-col rounded-xl border border-border-default bg-surface p-3 md:w-64 lg:w-72">
    <div class="mb-3 text-lg font-bold">{{ tr("FishingMapModal.countries") }}</div>
    <input
      v-model="store.countrySearch"
      type="search"
      class="mb-2 w-full shrink-0 rounded-lg border border-border-default bg-white px-3 py-2 text-sm"
      :aria-label="tr('FishingMapModal.countrySearch')"
      :placeholder="tr('FishingMapModal.countrySearch')"
    />
    <select
      v-model="store.countryFilter"
      class="mb-3 w-full shrink-0 rounded-lg border border-border-default bg-white px-3 py-2 text-sm"
      :aria-label="tr('FishingMapModal.countryFilter')"
    >
      <option value="all">{{ tr("FishingMapModal.allCountries") }}</option>
      <option value="unlocked">{{ tr("FishingMapModal.unlocked") }}</option>
      <option value="locked">{{ tr("FishingMapModal.locked") }}</option>
    </select>
    <nav
      :aria-label="tr('FishingMapModal.countries')"
      class="grid min-h-0 max-h-52 content-start gap-2 overflow-y-auto overscroll-contain md:max-h-none md:flex-1 md:pr-1"
    >
      <button
        v-for="country in store.countries"
        :key="country.id"
        type="button"
        class="flex w-full items-center gap-2 rounded-lg border border-border-default px-3 py-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-content"
        :class="
          store.selectedCountryId === country.id && store.canView
            ? 'bg-surface font-bold'
            : 'bg-white enabled:hover:bg-surface'
        "
        :disabled="store.loading || !store.unlockedIds.has(country.id)"
        :aria-current="store.selectedCountryId === country.id && store.canView ? 'true' : undefined"
        @click="store.selectCountry(country.id)"
      >
        <span class="min-w-0 flex-1 break-words">{{ country.name }}</span>
        <span class="shrink-0 text-xs">{{
          tr(store.unlockedIds.has(country.id) ? "FishingMapModal.unlocked" : "FishingMapModal.locked")
        }}</span>
      </button>
      <div v-if="!store.loading && !store.countries.length" role="status" class="py-4 text-center text-sm">
        {{ tr("FishingMapModal.noCountries") }}
      </div>
    </nav>
  </aside>
</template>
