<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useDiaryStore, type DiaryFishEntry } from "../../stores/diary";
import { useAuthStore } from "../../stores/auth";
import { mapData } from "../../data/map";
import BookShelf from "./BookShelf.vue";
import FlipBook from "./FlipBook.vue";
import Modal from "../Modal.vue";

type Country = { code: string; name: string; information: string };
const diaryStore = useDiaryStore();
const authStore = useAuthStore();
const viewMode = ref<"bookshelf" | "openbook">("bookshelf");
const selectedCountry = ref<Country | null>(null);

onMounted(() => diaryStore.initDiary(authStore.userId));
watch(() => authStore.userId, (userId) => { if (userId) diaryStore.initDiary(userId); });

const allCountries = computed<Country[]>(() =>
  Object.entries(mapData)
    .filter(([code]) => ["VN"].includes(code))
    .map(([code, item]) => ({ code, name: item.name, information: item.information || "" })),
);

const currentBookEntries = computed<DiaryFishEntry[]>(() => {
  if (!selectedCountry.value) return [];
  if (diaryStore.currentLocationEntries.length) return diaryStore.currentLocationEntries;
  return Array.from({ length: 10 }, (_, index) => ({
    species: {
      id: `mock-${selectedCountry.value!.code}-${index + 1}`, created_at: "", name: `Cá thần thoại #${index + 1}`,
      information: `Loài cá sinh sống tại khu vực ${selectedCountry.value!.name}. Hãy thả câu ở vùng biển này để ghi chép lại thông tin!`,
      location: selectedCountry.value!.code, status: "Chưa khám phá", image: null, "3d": null,
    },
    isCaught: false,
  }));
});

async function openCountryBook(country: Country) {
  selectedCountry.value = country;
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
  <Modal :title="viewMode === 'bookshelf' ? 'Nhật ký đánh bắt' : `Nhật ký đánh bắt: ${selectedCountry?.name}`">
    <div class="relative flex flex-col min-h-[620px] h-full w-full">
      <div class="mb-2">
        <button v-if="viewMode === 'openbook'" type="button" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800/80 hover:bg-amber-700 text-amber-100 font-bold text-xs border border-amber-500/50 transition-all cursor-pointer shadow" @click="returnToBookshelf">
          <span>⬅</span><span>Quay lại giá sách</span>
        </button>
      </div>

      <BookShelf v-if="viewMode === 'bookshelf'" :countries="allCountries" :species-count-by-location="diaryStore.speciesCountByLocation" @select-country="openCountryBook" />

      <div v-else class="flex-1 flex flex-col justify-between overflow-hidden relative">
        <div v-if="diaryStore.isLoading" class="flex-1 flex flex-col items-center justify-center p-12 text-amber-200">
          <div class="w-10 h-10 border border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p class="font-serif text-sm">Đang lật mở trang nhật ký {{ selectedCountry?.name }}...</p>
        </div>
        <FlipBook v-else-if="selectedCountry" :country="selectedCountry" :entries="currentBookEntries" @back="returnToBookshelf" />
      </div>
    </div>
  </Modal>
</template>
