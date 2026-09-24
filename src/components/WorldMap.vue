<script setup lang="ts">
import { computed, onMounted, watch, ref } from "vue";
import { useFishingAreaStore } from "../stores/fishingArea";
import { useCurrencyStore } from "../stores/currency";
import { useAuthStore } from "../stores/auth";
import InteractWorldWrapper from "./world-map/InteractWorldMap.vue";
import MarketWindow from "./market/MarketWindow.vue";
import { useMarketStore } from "../stores/market.ts";
import { useCaughtStore } from "../stores/caught.ts";
import CaughtList from "./caught/CaughtList.vue";


const isProfileOpen = ref(false);
const marketStore = useMarketStore()
const fishingAreaStore = useFishingAreaStore();
const currencyStore = useCurrencyStore();
const authStore = useAuthStore();
const caughtStore = useCaughtStore()

// Quản lý Chợ Cá (Market)
const isMarketOpen = ref(false);

function openMarketModal() {
  isMarketOpen.value = true;
  marketStore.loadMarketListings();
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

    
    


    <!-- Dialog xem thông tin cá nhân -->
    <div v-if="isProfileOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        class="w-full max-w-md bg-white border-[1px] border-gray-300 rounded-xl p-5 shadow-[0_12px_32px_rgba(38,50,56,0.25)] relative">
        <div class="flex items-center justify-between border-b border-gray-300 pb-3 mb-4">
          <h3 class="m-0 text-base font-bold text-[#263238]">Thông tin tài khoản</h3>
          <button type="button"
            class="border-0 bg-transparent text-[#263238] hover:text-[#d84315] font-bold text-xl cursor-pointer leading-none px-1"
            @click="isProfileOpen = false">
            &times;
          </button>
        </div>

        <div class="flex flex-col gap-3 text-xs text-[#263238]">
          <div class="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span class="text-gray-500 font-medium">Email</span>
            <span class="font-bold">{{ authStore.user?.email || "Chưa cập nhật" }}</span>
          </div>
          <div class="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span class="text-gray-500 font-medium">User ID</span>
            <span class="font-mono text-[11px] bg-gray-100 px-2 py-0.5 rounded">{{ authStore.user?.id || "N/A" }}</span>
          </div>
          <div class="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span class="text-gray-500 font-medium">Số tiền hiện tại</span>
            <span class="font-bold text-amber-600 text-sm">{{ currencyStore.formattedCash }} đ</span>
          </div>
        </div>

        <div class="mt-5 flex justify-end">
          <button type="button"
            class="py-1.5 px-4 rounded-lg border border-gray-300 bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1]"
            @click="isProfileOpen = false">
            Đóng
          </button>
        </div>
      </div>
    </div>
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
