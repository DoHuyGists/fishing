<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useGameCatalogRefresh } from "../../../composables/useGameCatalogRefresh";
import { t as tr } from "../../../i18n";
import { useDiaryStore } from "../../../stores/diary";
import { useAuthStore } from "../../../stores/auth";
import { useCountryStore } from "../../../stores/country";
import Modal from "../../shared/Modal.vue";
import DiaryCountryList from "./DiaryCountryList.vue";
import DiarySpeciesCard from "./DiarySpeciesCard.vue";

useGameCatalogRefresh(["species"]);

const diaryStore = useDiaryStore();
const authStore = useAuthStore();
const countryStore = useCountryStore();
const selectedCountryCode = ref("");
const selectedCountry = computed(() =>
  countryStore.unlockedCountries.find((country) => country.code === selectedCountryCode.value)
  ?? countryStore.unlockedCountries[0],
);
const caughtEntries = computed(() => selectedCountry.value
  ? diaryStore.caughtEntriesForCountry(selectedCountry.value.code, selectedCountry.value.name)
  : [],
);
const isLoading = computed(() => diaryStore.isLoading || countryStore.isLoadingUnlocked);

async function loadDiary(force = false) {
  await Promise.all([
    countryStore.fetchMyUnlockedCountries(authStore.userId ?? null, force),
    diaryStore.initDiary(authStore.userId, force),
  ]);
}

async function retry() {
  await loadDiary(true);
}

watch(() => authStore.userId, () => {
  selectedCountryCode.value = "";
  void loadDiary();
}, { immediate: true });
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
          {{ tr('Maintenance.thu_lai') }}
        </button>
      </div>
      <div v-if="isLoading" role="status" class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-8 text-center text-sm">
        {{ tr('CatchDiaryModal.dang_tai_nhat_ky') }}
      </div>
      <div
        v-else-if="!countryStore.unlockedCountries.length && !countryStore.unlockedError"
        class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-8 text-center text-sm"
      >
        {{ tr('CatchDiaryModal.ban_chua_mo_quoc_gia_nao_hay_mo_mot_khu_vuc_tren_ban_do_de_bat_d') }}
      </div>
      <div v-else-if="selectedCountry" class="grid min-h-0 flex-1 grid-cols-[116px_minmax(0,1fr)] gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4" :aria-busy="isLoading">
        <DiaryCountryList
          :countries="countryStore.unlockedCountries"
          :selected-code="selectedCountry.code"
          @select="selectedCountryCode = $event"
        />
        <section class="min-w-0 overflow-y-auto rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3 sm:p-5" :aria-label="tr('CatchDiaryModal.conqueredSpecies')">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#cbd9c6] pb-3">
            <div class="break-words text-base font-bold sm:text-xl">{{ selectedCountry.name }}</div>
            <span class="rounded-full border border-[#cbd9c6] bg-white px-3 py-1 text-xs font-semibold">
              {{ tr('CatchDiaryModal.conqueredCount', { value0: caughtEntries.length }) }}
            </span>
          </div>
          <div v-if="!diaryStore.error && !caughtEntries.length" role="status" class="py-12 text-center text-sm leading-6">
            {{ tr('CatchDiaryModal.noConqueredSpecies') }}
          </div>
          <div v-else-if="!diaryStore.error" :key="selectedCountry.code" class="slide-fade-in from-bottom player-content-in grid gap-3 xl:grid-cols-2">
            <DiarySpeciesCard v-for="entry in caughtEntries" :key="entry.species.id" :entry="entry" />
          </div>
        </section>
      </div>
    </div>
  </Modal>
</template>
