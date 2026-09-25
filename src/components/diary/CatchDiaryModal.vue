<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useDiaryStore, type DiaryFishEntry } from "../../stores/diary";
import { useAuthStore } from "../../stores/auth";
import { mapData } from "../../data/map";
import FlipBook from "./FlipBook.vue";
import BookCover, { type BookVariant } from "./BookCover.vue";

const emit = defineEmits(["close"]);

const diaryStore = useDiaryStore();
const authStore = useAuthStore();

// View Mode: 'bookshelf' (Giá sách) | 'openbook' (Xem nội dung sách 3D)
const viewMode = ref<"bookshelf" | "openbook">("bookshelf");

// Selected Country
const selectedCountry = ref<{ code: string; name: string; information: string } | null>(null);

// Bookshelf Pagination & Search State
const searchQuery = ref("");
const shelfPage = ref(0);
const SHELF_PAGE_SIZE = 12; // 12 quyển sách trên 1 trang giá sách

onMounted(() => {
  diaryStore.initDiary(authStore.user?.id);
});

watch(
  () => authStore.user?.id,
  (userId) => {
    if (userId) {
      diaryStore.initDiary(userId);
    }
  }
);

// Format list of all countries from mapData
const allCountries = computed(() => {
  return Object.entries(mapData).map(([code, item]) => ({
    code,
    name: item.name,
    information: item.information || "",
  }));
});

// Filtered countries based on search query
const filteredCountries = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return allCountries.value;
  return allCountries.value.filter(
    (c) => c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)
  );
});

// Paginated countries on current bookshelf page
const totalShelfPages = computed(() => {
  return Math.max(1, Math.ceil(filteredCountries.value.length / SHELF_PAGE_SIZE));
});

const paginatedCountries = computed(() => {
  const start = shelfPage.value * SHELF_PAGE_SIZE;
  return filteredCountries.value.slice(start, start + SHELF_PAGE_SIZE);
});

function prevShelfPage() {
  if (shelfPage.value > 0) shelfPage.value--;
}

function nextShelfPage() {
  if (shelfPage.value < totalShelfPages.value - 1) shelfPage.value++;
}

// Reset page when search query changes
watch(searchQuery, () => {
  shelfPage.value = 0;
});

// Get species count for a country
function getSpeciesCount(country: { code: string; name: string }): number {
  return (
    diaryStore.speciesCountByLocation[country.code] ||
    diaryStore.speciesCountByLocation[country.name.toUpperCase()] ||
    0
  );
}

// Determine Book variant based on collection status & country hash
function getBookVariant(countryCode: string, speciesCount: number): BookVariant {
  if (speciesCount >= 10) return "gold";
  if (speciesCount >= 5) return "emerald";
  if (speciesCount > 0) return "ocean";

  const hash = countryCode.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variants: BookVariant[] = ["default", "dark", "ocean", "emerald", "gold"];
  return variants[hash % variants.length];
}

// Species entries for the opened book
const currentBookEntries = computed<DiaryFishEntry[]>(() => {
  if (!selectedCountry.value) return [];
  const entries = diaryStore.currentLocationEntries;

  if (entries.length > 0) return entries;

  const mockSpeciesList: DiaryFishEntry[] = [];
  for (let i = 1; i <= 10; i++) {
    mockSpeciesList.push({
      species: {
        id: `mock-${selectedCountry.value.code}-${i}`,
        created_at: "",
        name: `Cá thần thoại #${i}`,
        information: `Loài cá sinh sống tại khu vực ${selectedCountry.value.name}. Hãy thả câu ở vùng biển này để ghi chép lại thông tin!`,
        location: selectedCountry.value.code,
        status: "Chưa khám phá",
        image: null,
      },
      isCaught: false,
    });
  }
  return mockSpeciesList;
});

// Stats for selected country book
const countryStats = computed(() => {
  const entries = currentBookEntries.value;
  const total = entries.length;
  const caught = entries.filter((e) => e.isCaught).length;
  return { total, caught };
});

// Open a country book
async function openCountryBook(country: { code: string; name: string; information: string }) {
  selectedCountry.value = country;
  await diaryStore.selectLocation(authStore.user?.id, country.code, country.name);
  viewMode.value = "openbook";
}

function returnToBookshelf() {
  viewMode.value = "bookshelf";
  selectedCountry.value = null;
  diaryStore.clearSelectedLocation();
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-6 overflow-y-auto">
    <!-- Main Window Container -->
    <div class="relative w-full max-w-6xl bg-[#1c120c] rounded-2xl p-4 md:p-6 shadow-[0_25px_70px_rgba(0,0,0,0.9)] border-4 border-[#4a2e1b] text-amber-100 flex flex-col min-h-[620px] max-h-[92vh]">

      <!-- Close Button -->
      <button
        type="button"
        class="absolute -top-3 -right-3 z-50 w-10 h-10 rounded-full bg-amber-900 border-2 border-amber-400 text-amber-100 font-bold text-xl flex items-center justify-center hover:bg-amber-800 transition-transform active:scale-95 shadow-xl cursor-pointer"
        @click="emit('close')"
        title="Đóng nhật ký"
      >
        ✕
      </button>

      <!-- TOP BAR HEADER -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-900/50 pb-3 mb-4 shrink-0">
        <div class="flex items-center gap-3">
          <button
            v-if="viewMode === 'openbook'"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800/80 hover:bg-amber-700 text-amber-100 font-bold text-xs border border-amber-500/50 transition-all cursor-pointer shadow"
            @click="returnToBookshelf"
          >
            <span>⬅</span>
            <span>Quay lại giá sách</span>
          </button>

          <div class="flex items-center gap-2">
            <span class="text-2xl md:text-3xl">📚</span>
            <div>
              <h2 class="m-0 text-lg md:text-2xl font-serif font-bold text-amber-200 tracking-wide">
                {{ viewMode === 'bookshelf' ? 'Giá Sách Nhật Ký Quốc Gia' : `Nhật Ký Câu Cá: ${selectedCountry?.name}` }}
              </h2>
              <p class="m-0 text-xs text-amber-400/80">
                {{ viewMode === 'bookshelf' ? `Tổng cộng ${allCountries.length} quốc gia` : `Mã quốc gia: ${selectedCountry?.code} • ${countryStats.caught}/${countryStats.total} loài đã thu thập` }}
              </p>
            </div>
          </div>
        </div>

        <!-- Search Bar on Bookshelf mode -->
        <div v-if="viewMode === 'bookshelf'" class="flex items-center gap-2">
          <div class="relative w-48 md:w-64">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="🔍 Tìm quốc gia (VN, Japan...)"
              class="w-full bg-[#2a1b12] border border-amber-700/60 rounded-xl px-3 py-1.5 text-xs text-amber-100 placeholder-amber-400/50 focus:outline-none focus:border-amber-400 shadow-inner"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-200 text-xs font-bold"
              @click="searchQuery = ''"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- ================= MODE 1: BOOKSHELF (GIÁ SÁCH CÁC QUỐC GIA) ================= -->
      <div v-if="viewMode === 'bookshelf'" class="flex-1 flex flex-col justify-between overflow-hidden">
        <!-- Shelf Display Grid -->
        <div class="flex-1 bg-[#281910] rounded-xl p-4 md:p-6 border border-amber-900/40 overflow-y-auto shadow-inner">
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 py-2">
            <div
              v-for="country in paginatedCountries"
              :key="country.code"
              class="group relative flex flex-col items-center justify-between p-3 rounded-2xl bg-gradient-to-b from-[#3a2213]/60 to-[#1c1008]/80 border border-amber-900/40 hover:border-amber-400/80 shadow-lg hover:shadow-amber-950/90 transition-all duration-300 cursor-pointer transform hover:-translate-y-2"
              @click="openCountryBook(country)"
            >
              <!-- 3D Dynamic Book Component Container -->
              <div class="w-[140px] h-[190px] flex items-center justify-center overflow-hidden my-1">
                <BookCover
                  :title="country.name"
                  author="Nhật Ký Câu Cá"
                  :num-up="country.code"
                  :num-down="`${getSpeciesCount(country)} loài`"
                  :variant="getBookVariant(country.code, getSpeciesCount(country))"
                  :scale="0.33"
                >
                  <template #cover-icon>
                    <div class="absolute inset-0 flex flex-col items-center justify-center opacity-90 pointer-events-none">
                      <span class="text-4xl drop-shadow-md">{{ country.code }}</span>
                    </div>
                  </template>
                </BookCover>
              </div>

              <!-- Country Title & Species Count Badge -->
              <div class="w-full text-center mt-2 pt-2 border-t border-amber-800/40">
                <h3 class="m-0 text-xs md:text-sm font-serif font-bold text-amber-200 group-hover:text-amber-100 truncate px-1">
                  {{ country.name }}
                </h3>
                <span
                  class="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  :class="[
                    getSpeciesCount(country) > 0
                      ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-600/40'
                      : 'bg-amber-950/60 text-amber-400/70 border border-amber-900/40'
                  ]"
                >
                  {{ getSpeciesCount(country) }} loài cá
                </span>
              </div>
            </div>
          </div>

          <!-- Empty Search State -->
          <div v-if="paginatedCountries.length === 0" class="flex flex-col items-center justify-center p-12 text-amber-300/70">
            <span class="text-4xl mb-2">🔍</span>
            <p class="font-serif text-base">Không tìm thấy quốc gia phù hợp với "{{ searchQuery }}"</p>
          </div>
        </div>

        <!-- Bookshelf Pagination Bar -->
        <div class="mt-4 pt-2 border-t border-amber-900/40 flex items-center justify-between text-xs font-serif">
          <button
            type="button"
            class="px-3.5 py-1.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 disabled:opacity-40 text-amber-100 font-bold transition-all cursor-pointer border border-amber-700/40"
            :disabled="shelfPage === 0"
            @click="prevShelfPage"
          >
            ◀ Trang trước
          </button>

          <span class="text-amber-300 font-bold">
            Trang giá sách {{ shelfPage + 1 }} / {{ totalShelfPages }}
          </span>

          <button
            type="button"
            class="px-3.5 py-1.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 disabled:opacity-40 text-amber-100 font-bold transition-all cursor-pointer border border-amber-700/40"
            :disabled="shelfPage === totalShelfPages - 1"
            @click="nextShelfPage"
          >
            Trang sau ▶
          </button>
        </div>
      </div>

      <!-- ================= MODE 2: OPENED BOOK (HIỆU ỨNG 3D PAGE FLIP BOOK) ================= -->
      <div v-else class="flex-1 flex flex-col justify-between overflow-hidden relative">

        <!-- Loading State for Book -->
        <div v-if="diaryStore.isLoading" class="flex-1 flex flex-col items-center justify-center p-12 text-amber-200">
          <div class="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p class="font-serif text-sm">Đang lật mở trang nhật ký {{ selectedCountry?.name }}...</p>
        </div>

        <!-- 3D FlipBook Component -->
        <FlipBook
          v-else-if="selectedCountry"
          :country="selectedCountry"
          :entries="currentBookEntries"
          @back="returnToBookshelf"
        />
      </div>

    </div>
  </div>
</template>
