<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useDiaryStore } from "../../../stores/diary.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useCountryStore } from "../../../stores/country.ts";
import type { Country } from "../../../stores/country.ts";
import BookShelf from "./BookShelf.vue";
import FlipBook from "./FlipBook.vue";
import Modal from "../../shared/Modal.vue";

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
  await diaryStore.initDiary(authStore.userId);
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
  <Modal :title="viewMode === 'bookshelf' ? 'Nhật ký đánh bắt' : `Nhật ký đánh bắt: ${selectedCountry?.name}`" :on-refresh="retry">
    <div class="relative flex flex-col min-h-[620px] h-full w-full">
      <div class="mb-2">
        <button
          v-if="viewMode === 'openbook'"
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800/80 hover:bg-amber-700 text-amber-100 font-bold text-xs border border-amber-500/50 transition-all cursor-pointer shadow"
          @click="returnToBookshelf"
        >
          <span>⬅</span><span>Quay lại giá sách</span>
        </button>
      </div>

      <div v-if="diaryStore.error || countryStore.unlockedError" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
        <div>{{ diaryStore.error || countryStore.unlockedError }}</div><button type="button" class="mt-2 underline" @click="retry">Thử lại</button>
      </div>
      <div v-else-if="viewMode === 'bookshelf' && (diaryStore.isLoading || countryStore.isLoadingUnlocked)" class="p-8 text-center">Đang tải nhật ký…</div>
      <div v-else-if="viewMode === 'bookshelf' && !unlockedCountries.length" class="p-8 text-center">Bạn chưa mở quốc gia nào. Hãy mở một khu vực trên bản đồ để bắt đầu nhật ký.</div>
      <BookShelf
        v-else-if="viewMode === 'bookshelf'"
        :countries="unlockedCountries"
        :species-count-by-location="diaryStore.speciesCountByLocation"
        @select-country="openCountryBook"
      />

      <div v-else class="flex-1 flex flex-col justify-between overflow-hidden relative">
        <div v-if="diaryStore.isLoading" class="flex-1 flex flex-col items-center justify-center p-12 text-amber-200">
          <div class="w-10 h-10 border border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
          <div class="font-serif text-sm">Đang lật mở trang nhật ký {{ selectedCountry?.name }}...</div>
        </div>
        <div v-else-if="!currentBookEntries.length" class="p-8 text-center text-[#24352a]">Quốc gia này chưa có dữ liệu loài cá.</div>
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
