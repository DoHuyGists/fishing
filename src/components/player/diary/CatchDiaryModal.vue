<script setup lang="ts">
import { useGameCatalogRefresh } from '../../../composables/useGameCatalogRefresh';
import { t as tr } from "../../../i18n";

import { computed, onMounted, ref, watch } from "vue";
import { useDiaryStore } from "../../../stores/diary.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useCountryStore } from "../../../stores/country.ts";
import type { Country } from "../../../stores/country.ts";
import BookShelf from "./BookShelf.vue";
import FlipBook from "./FlipBook.vue";
import Modal from "../../shared/Modal.vue";

useGameCatalogRefresh(['species']);

const diaryStore = useDiaryStore();
const authStore = useAuthStore();
const countryStore = useCountryStore();
const viewMode = ref<"bookshelf" | "openbook">("bookshelf");
const selectedCountry = ref<Country | null>(null);

onMounted(() => {
  countryStore.fetchMyUnlockedCountries();
  diaryStore.initDiary(authStore.userId);
});
watch(
  () => authStore.userId,
  (userId) => {
    if (userId) diaryStore.initDiary(userId);
  },
);

const unlockedCountries = computed<Country[]>(() => countryStore.unlockedCountries);

const currentBookEntries = computed(() => diaryStore.currentLocationEntries);
async function retry() {
  await countryStore.fetchMyUnlockedCountries();
  await diaryStore.initDiary(authStore.userId, true);
  if (selectedCountry.value) await diaryStore.selectLocation(authStore.userId, selectedCountry.value.code, selectedCountry.value.name);
}

async function openCountryBook(country: Country) {
  selectedCountry.value = country;
  viewMode.value = "openbook";
  await diaryStore.selectLocation(authStore.userId, country.code, country.name);
  viewMode.value = "openbook";
}

function returnToBookshelf() {
  viewMode.value = "bookshelf";
  selectedCountry.value = null;
  diaryStore.clearSelectedLocation();
}
</script>

<template>
  <Modal :title="viewMode === 'bookshelf' ? tr('CatchDiaryModal.nhat_ky_danh_bat') : tr('CatchDiaryModal.nhat_ky_danh_bat_value0', { value0: selectedCountry?.name })" :on-refresh="retry">
    <div class="relative flex flex-col min-h-[620px] h-full w-full">
      <div class="mb-2">
        <button
          v-if="viewMode === 'openbook'"
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800/80 hover:bg-amber-700 text-amber-100 font-bold text-xs border border-amber-500/50 transition-all cursor-pointer shadow"
          @click="returnToBookshelf"
        >
          <span>⬅</span><span>{{ tr('CatchDiaryModal.quay_lai_gia_sach') }}</span>
        </button>
      </div>

      <div v-if="diaryStore.error || countryStore.unlockedError" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
        <div>{{ diaryStore.error || countryStore.unlockedError }}</div><button type="button" class="mt-2 underline" @click="retry">{{ tr('Maintenance.thu_lai') }}</button>
      </div>
      <div v-else-if="viewMode === 'bookshelf' && (diaryStore.isLoading || countryStore.isLoadingUnlocked)" class="p-8 text-center">{{ tr('CatchDiaryModal.dang_tai_nhat_ky') }}</div>
      <div v-else-if="viewMode === 'bookshelf' && !unlockedCountries.length" class="p-8 text-center">{{ tr('CatchDiaryModal.ban_chua_mo_quoc_gia_nao_hay_mo_mot_khu_vuc_tren_ban_do_de_bat_d') }}</div>
      <BookShelf
        v-else-if="viewMode === 'bookshelf'"
        :countries="unlockedCountries"
        :species-count-by-location="diaryStore.speciesCountByLocation"
        @select-country="openCountryBook"
      />

      <div v-else class="flex-1 flex flex-col justify-between overflow-hidden relative">
        <div v-if="diaryStore.isLoading" class="flex-1 flex flex-col items-center justify-center p-12 text-amber-200">
          <div class="w-10 h-10 border border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
          <div class="font-serif text-sm">{{ tr('CatchDiaryModal.dang_lat_mo_trang_nhat_ky') }} {{ selectedCountry?.name }}...</div>
        </div>
        <div v-else-if="!currentBookEntries.length" class="p-8 text-center text-[#24352a]">{{ tr('CatchDiaryModal.quoc_gia_nay_chua_co_du_lieu_loai_ca') }}</div>
        <FlipBook
          v-else-if="selectedCountry"
          :country="selectedCountry"
          :entries="currentBookEntries"
          @back="returnToBookshelf"
        />
      </div>
    </div>
  </Modal>
</template>
