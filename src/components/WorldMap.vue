<script setup lang="ts">
import { onMounted, watch, ref } from "vue";
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
import SpinWheelModal from "./spin-wheel/SpinWheelModal.vue";
import InventoryModal from "./inventory/InventoryModal.vue";
import Feedbackmodal from "./feedback/Feedbackmodal.vue";
import MissionModal from "./mission/MissionModal.vue";


const isProfileOpen = ref(false);
const marketStore = useMarketStore()
const currencyStore = useCurrencyStore();
const authStore = useAuthStore();
const caughtStore = useCaughtStore();
const diaryStore = useDiaryStore();

// Quản lý Chợ Cá (Market)
const isMarketOpen = ref(false);

// Quản lý Nhật ký câu (Diary)
const isDiaryOpen = ref(false);
const isSpinWheelOpen = ref(false);
const isInventoryOpen = ref(false);
const isFeedbackFormOpen = ref(false);
const isMissionModalOpen = ref(false);

function openMarketModal() {
  isMarketOpen.value = true;
  marketStore.loadMarketListings();
}

function openDiaryModal() {
  isDiaryOpen.value = true;
  diaryStore.loadDiary(authStore.userId);
}

function openSpinWheelModal() {
  isSpinWheelOpen.value = true;
}

function openInventoryModal() {
  isInventoryOpen.value = true;
}

function openFeedbackForm() {
  isFeedbackFormOpen.value = true;
}

function openMissionModal() {
  isMissionModalOpen.value = true;
}


watch(
  () => authStore.userId,
  (userId) => {
    if (userId) {
      currencyStore.fetchCurrency(userId);
      caughtStore.loadCaughtFishes();
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (authStore.userId) {
    currencyStore.fetchCurrency(authStore.userId);
    caughtStore.loadCaughtFishes();
  }
});


</script>

<template>
  <div class="map-page h-screen p-3 relative flex gap-3 overflow-hidden">

    <!-- Khung Bản đồ trung tâm -->
    <InteractWorldWrapper />

    <!-- Sidebar phải: Danh sách cá đã câu được -->
    <CaughtList />

    <div>
      <div class="flex items-center flex-wrap gap-2">
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="isProfileOpen = true">
          <span class="text-sm">⚙️</span>
          <span>Tài khoản</span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="openMarketModal">
          <span class="text-sm">🏪</span>
          <span>Chợ cá</span>
        </button>

        <!-- Nhật ký -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="openDiaryModal">
          <span class="text-sm">📖</span>
          <span>Nhật ký</span>
        </button>

        <!-- Gacha -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="openSpinWheelModal">
          <span class="text-sm">🎁</span>
          <span>Gacha</span>
        </button>

        <!-- Túi đồ -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="openInventoryModal">
          <span class="text-sm">📦</span>
          <span>Túi đồ</span>
        </button>

        <!-- Feedback -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="openFeedbackForm">
          <span class="text-sm">📄</span>
          <span>Phản hồi</span>
        </button>

        <!-- Mission -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="openMissionModal">
          <span class="text-sm">📄</span>
          <span>Nhiệm vụ</span>
        </button>
      </div>
    </div>

    <!-- Market Modal Dialog -->
    <MarketWindow v-if="isMarketOpen" @close="isMarketOpen = false" />

    <!-- Nhật ký Modal Dialog -->
    <CatchDiaryModal v-if="isDiaryOpen" @close="isDiaryOpen = false" />

    <!-- Dialog xem thông tin cá nhân -->
    <AccountInfoModal v-if="isProfileOpen" @close="isProfileOpen = false" />

    <!-- Gacha -->
    <SpinWheelModal v-if="isSpinWheelOpen" @close="isSpinWheelOpen = false" />

    <!-- Inventory -->
    <InventoryModal v-if="isInventoryOpen" @close="isInventoryOpen = false" />

    <!-- Feedback -->
     <Feedbackmodal v-if="isFeedbackFormOpen" @close="isFeedbackFormOpen = false"/>

    <!-- Mission -->
     <MissionModal v-if="isMissionModalOpen" @close="isMissionModalOpen = false"/>
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
