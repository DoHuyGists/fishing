<script setup lang="ts">
import { onMounted, watch, ref } from "vue";
import { useFishingAreaStore } from "../stores/fishingArea";
import { useCurrencyStore } from "../stores/currency";
import { useAuthStore } from "../stores/auth";
import InteractWorldWrapper from "./world-map/InteractWorldMap.vue";
import MarketWindow from "./market/MarketWindow.vue";
import { useMarketStore } from "../stores/market.ts";
import { useCaughtStore } from "../stores/caught.ts";
import CaughtList from "./caught/CaughtList.vue";
import CatchDiaryModal from "./diary/CatchDiaryModal.vue";
import { useDiaryStore } from "../stores/diary.ts";
import AccountInfoModal from "./account/AccountInfoModal.vue";


const isProfileOpen = ref(false);
const marketStore = useMarketStore()
const fishingAreaStore = useFishingAreaStore();
const currencyStore = useCurrencyStore();
const authStore = useAuthStore();
const caughtStore = useCaughtStore();
const diaryStore = useDiaryStore();

// Quản lý Chợ Cá (Market)
const isMarketOpen = ref(false);

// Quản lý Nhật ký câu (Diary)
const isDiaryOpen = ref(false);

function openMarketModal() {
  isMarketOpen.value = true;
  marketStore.loadMarketListings();
}

function openDiaryModal() {
  isDiaryOpen.value = true;
  diaryStore.loadDiary(authStore.user?.id);
}



watch(
  () => authStore.user?.id,
  (userId) => {
    if (userId) {
      currencyStore.fetchCurrency(userId);
      caughtStore.loadCaughtFishes();
    }
  },
  { immediate: true }
);

watch(
  () => fishingAreaStore.areas,
  () => {
    if (caughtStore.caughtFishes.length && fishingAreaStore.areas.length) {
      caughtStore.caughtFishes = caughtStore.caughtFishes.map((row) => {
        const area = fishingAreaStore.areas.find((a) => a.id === row.area_id);
        return {
          ...row,
          areaName: area?.title ?? row.areaName ?? "Bãi câu",
        };
      });
    }
  }
);

onMounted(() => {
  if (authStore.user?.id) {
    currencyStore.fetchCurrency(authStore.user.id);
    caughtStore.loadCaughtFishes();
  }
});


</script>

<template>
  <div class="map-page h-screen p-3 relative flex gap-3 overflow-hidden">

    <!-- Khung Bản đồ trung tâm -->
    <InteractWorldWrapper />

    <!-- Sidebar phải: Danh sách cá đã câu được -->
    <CaughtList/>

    <div>
      <div class="flex items-center gap-2">
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border-[1px] border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="isProfileOpen = true">
          <span class="text-sm">⚙️</span>
          <span>Tài khoản</span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border-[1px] border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="openMarketModal">
          <span class="text-sm">🏪</span>
          <span>Chợ cá</span>
        </button>

        <!-- Nhật ký -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border-[1px] border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="openDiaryModal">
          <span class="text-sm">📖</span>
          <span>Nhật ký</span>
        </button>
      </div>
    </div>

    <!-- Market Modal Dialog -->
   <MarketWindow v-if="isMarketOpen">
    <button type="button"
        class="w-8 h-8 rounded-full border border-emerald-600/50 bg-emerald-900/50 text-white hover:bg-emerald-800 font-bold text-lg flex items-center justify-center cursor-pointer transition-colors"
        @click="isMarketOpen = false">
        &times;
      </button>
   </MarketWindow>

    <!-- Nhật ký Modal Dialog -->
    <CatchDiaryModal v-if="isDiaryOpen" @close="isDiaryOpen = false" />

    <!-- Dialog xem thông tin cá nhân -->
    <AccountInfoModal v-if="isProfileOpen" @close="isProfileOpen = false"/>
  </div>
</template>

<style lang="css">
@media (max-width: 1024px) {
  .map-page {
    height: auto;
    min-height: 100vh;
    flex-direction: column;
    overflow: auto;
  }
  .map-sidebar,
  .caught-sidebar {
    width: 100%;
    flex-basis: auto;
    height: 350px;
  }
}
</style>
