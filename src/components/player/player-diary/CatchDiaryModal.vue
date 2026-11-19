<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useGameCatalogRefresh } from "../../../composables/useGameCatalogRefresh";
import { t as tr } from "../../../i18n";
import { useDiaryStore } from "../../../stores/player-diary-store.ts";
import { useAuthStore } from "../../../stores/auth";
import { useCountryStore } from "../../../stores/player-country-store.ts";
import Modal from "../../shared/Modal.vue";
import Tab from "../../shared/Tab.vue";
import DiaryCountryList from "./DiaryCountryList.vue";
import DiarySpeciesCard from "./DiarySpeciesCard.vue";

useGameCatalogRefresh(["species"]);

const diaryStore = useDiaryStore();
const authStore = useAuthStore();
const countryStore = useCountryStore();
const selectedCountryCode = ref("");
const selectedCountry = computed(
  () =>
    countryStore.unlockedCountries.find((country) => country.code === selectedCountryCode.value) ??
    countryStore.unlockedCountries[0],
);
const entries = computed(() =>
  selectedCountry.value ? diaryStore.entriesForCountry(selectedCountry.value.code, selectedCountry.value.name) : [],
);
const filteredEntries = computed(() =>
  selectedCountry.value
    ? diaryStore.filteredEntriesForCountry(selectedCountry.value.code, selectedCountry.value.name)
    : [],
);
// The background map shares this store and polls unlocked countries. Keep the
// diary mounted while those reads refresh an already displayed country list.
const isLoading = computed(
  () => diaryStore.isLoading || (countryStore.isLoadingUnlocked && !countryStore.unlockedCountries.length),
);
const caughtCount = computed(() => entries.value.filter((entry) => entry.isCaught).length);
const viewModes = computed(() => [
  { key: "grid", label: tr("FishingMapModal.grid") },
  { key: "list", label: tr("FishingMapModal.list") },
]);

async function loadDiary(force = false) {
  await Promise.all([
    countryStore.fetchMyUnlockedCountries(authStore.userId ?? null, force),
    diaryStore.initDiary(authStore.userId, force),
  ]);
}

async function retry() {
  await loadDiary(true);
}

watch(
  () => authStore.userId,
  () => {
    selectedCountryCode.value = "";
    diaryStore.speciesSearch = "";
    void loadDiary();
  },
  { immediate: true },
);
</script>

<template>
  <Modal :title="tr('CatchDiaryModal.nhat_ky_danh_bat')" :on-refresh="retry">
    <div class="flex h-full min-h-[420px] flex-col gap-3 text-[#24352a]">
      <div
        v-if="diaryStore.error || countryStore.unlockedError"
        role="alert"
        class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        <div>{{ diaryStore.error || countryStore.unlockedError }}</div>
        <button type="button" class="mt-2 cursor-pointer underline" @click="retry">
          {{ tr("Maintenance.thu_lai") }}
        </button>
      </div>
      <div
        v-if="isLoading"
        role="status"
        class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-8 text-center text-sm"
      >
        {{ tr("CatchDiaryModal.dang_tai_nhat_ky") }}
      </div>
      <div
        v-else-if="!countryStore.unlockedCountries.length && !countryStore.unlockedError"
        class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-8 text-center text-sm"
      >
        {{ tr("CatchDiaryModal.ban_chua_mo_quoc_gia_nao_hay_mo_mot_khu_vuc_tren_ban_do_de_bat_d") }}
      </div>
      <div
        v-else-if="selectedCountry"
        class="grid min-h-0 flex-1 grid-cols-[116px_minmax(0,1fr)] gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4"
        :aria-busy="isLoading"
      >
        <DiaryCountryList
          :countries="countryStore.unlockedCountries"
          :selected-code="selectedCountry.code"
          @select="selectedCountryCode = $event"
        />
        <section
          class="min-w-0 overflow-y-auto rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3 sm:p-5"
          :aria-label="tr('CatchDiaryModal.species')"
        >
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#cbd9c6] pb-3">
            <div class="break-words text-base font-bold sm:text-xl">{{ selectedCountry.name }}</div>
            <span class="rounded-full border border-[#cbd9c6] bg-white px-3 py-1 text-xs font-semibold">
              {{ tr("CatchDiaryModal.conqueredCount", { value0: caughtCount }) }} / {{ entries.length }}
            </span>
          </div>
          <input
            v-if="!diaryStore.error && entries.length"
            v-model="diaryStore.speciesSearch"
            type="search"
            :aria-label="tr('CatchDiaryModal.searchSpecies')"
            :placeholder="tr('CatchDiaryModal.searchSpecies')"
            class="mb-3 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#698563] focus:ring-2 focus:ring-[#cbd9c6]"
          />
          <div v-if="!diaryStore.error && !entries.length" role="status" class="py-12 text-center text-sm leading-6">
            {{ tr("CatchDiaryModal.noSpecies") }}
          </div>
          <Tab
            v-else-if="!diaryStore.error"
            v-model="diaryStore.viewMode"
            :tabs="viewModes"
            :aria-label="tr('CaughtModal.che_do_hien_thi')"
          >
            <template v-for="mode in viewModes" :key="mode.key" #[mode.key]>
              <div v-if="!filteredEntries.length" role="status" class="py-12 text-center text-sm leading-6">
                {{ tr("CatchDiaryModal.noMatchingSpecies") }}
              </div>
              <div
                v-else
                class="slide-fade-in from-bottom player-content-in grid gap-3 pt-3"
                :class="
                  mode.key === 'grid' ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))]' : 'grid-cols-1'
                "
              >
                <DiarySpeciesCard
                  v-for="entry in filteredEntries"
                  :key="entry.species.id"
                  :entry="entry"
                  :list="mode.key === 'list'"
                />
              </div>
            </template>
          </Tab>
        </section>
      </div>
    </div>
  </Modal>
</template>
