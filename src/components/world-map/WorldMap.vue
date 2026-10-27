<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref, watch } from "vue";
import { useAuthStore } from "../../stores/auth.ts";
import { useCaughtStore } from "../../stores/caught.ts";
import { useModalStore } from "../../stores/modal.ts";
import { useNotificationStore } from "../../stores/notification";
import LatestCaughtList from "../caught/LatestCaughtList.vue";
import { useConfigStore } from "../../stores/config.ts";
import { useUserTurnsStore } from "../../stores/userTurns";
import UserTurn from "../stamina/UserTurn.vue";
import PrepareModal from "./PrepareModal.vue";

const InteractWorldMap2 = defineAsyncComponent(() => import("./InteractWorldMap2.vue"));
const AccountInfoModal = defineAsyncComponent(() => import("../account/AccountInfoModal.vue"));
const MarketWindow = defineAsyncComponent(() => import("../market/MarketWindow.vue"));
const ShopModal = defineAsyncComponent(() => import("../shop/ShopModal.vue"));
const CatchDiaryModal = defineAsyncComponent(() => import("../diary/CatchDiaryModal.vue"));
const SpinWheelModal = defineAsyncComponent(() => import("../spin-wheel/SpinWheelModal.vue"));
const InventoryModal = defineAsyncComponent(() => import("../inventory/InventoryModal.vue"));
const Feedbackmodal = defineAsyncComponent(() => import("../feedback/Feedbackmodal.vue"));
const MissionModal = defineAsyncComponent(() => import("../mission/MissionModal.vue"));
const EventModal = defineAsyncComponent(() => import("../event/EventModal.vue"));
const RedeemCode = defineAsyncComponent(() => import("../redeem-code/RedeemCode.vue"));
const NotificationModal = defineAsyncComponent(() => import("../notification/NotificationModal.vue"));
const CaughtModal = defineAsyncComponent(() => import("../caught/CaughtModal.vue"));
const FactionSelectModal = defineAsyncComponent(() => import("../faction/FactionSelectModal.vue"));
const Achievement = defineAsyncComponent(() => import("../badge/Achievement.vue"));
const FriendModal = defineAsyncComponent(() => import("../friend/FriendModal.vue"));
const TeamModal = defineAsyncComponent(() => import("../team/TeamModal.vue"));
const PostProduction = defineAsyncComponent(() => import("../fishing-post-production/PostProduction.vue"));

const authStore = useAuthStore();
const caughtStore = useCaughtStore();
const modalStore = useModalStore();
const notificationStore = useNotificationStore();
const configStore = useConfigStore();
const userTurnsStore = useUserTurnsStore();

const hasNewNotification = ref(false);

const MAP_VISIBLE_STORAGE_KEY = "worldMap2Visible";
const isMapVisible = ref(localStorage.getItem(MAP_VISIBLE_STORAGE_KEY) !== "false");
watch(isMapVisible, (value) => localStorage.setItem(MAP_VISIBLE_STORAGE_KEY, String(value)));

onMounted(() => {
  void userTurnsStore.fetchStatus().then(() => userTurnsStore.startCountdown());
  if (authStore.userId) {
    caughtStore.loadCaughtFishes();
    notificationStore.subscribeToNewNotifications(authStore.userId, () => {
      hasNewNotification.value = true;
    });
  }
});

onUnmounted(() => {
  void notificationStore.unsubscribeFromNewNotifications();
  userTurnsStore.stopCountdown();
});
</script>

<template>
  <div class="w-screen min-h-screen p-3 relative flex flex-col gap-2 overflow-x-hidden">
    <header
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2.5 text-[#24352a]"
    >
      <span class="font-bold">Bản đồ thế giới</span>
      <UserTurn />
    </header>
    <main class="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2">
      <!-- Khung Bản đồ trung tâm -->
      <div class="">
        <button
          type="button"
          class="mb-2 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] font-bold text-xs cursor-pointer"
          @click="isMapVisible = !isMapVisible"
        >
          {{ isMapVisible ? "🙈 Ẩn bản đồ" : "🗺️ Hiện bản đồ" }}
        </button>
        <InteractWorldMap2 v-if="isMapVisible" />
      </div>
      <div class="">
        <div class="flex items-center flex-wrap gap-2">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('account')"
          >
            <span class="text-sm">⚙️</span>
            <span>Tài khoản</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('market')"
          >
            <span class="text-sm">🏪</span>
            <span>Chợ cá</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('shop')"
          >
            <span class="text-sm" aria-hidden="true">🎁</span>
            <span>Cửa hàng</span>
          </button>

          <!-- Nhật ký -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('diary')"
          >
            <span class="text-sm">📖</span>
            <span>Nhật ký</span>
          </button>

          <!-- Gacha -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('gacha')"
          >
            <span class="text-sm">🎁</span>
            <span>Gacha</span>
          </button>

          <!-- Túi đồ -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('inventory')"
          >
            <span class="text-sm">📦</span>
            <span>Túi đồ</span>
          </button>

          <!-- Feedback -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('feedback')"
          >
            <span class="text-sm">📄</span>
            <span>Phản hồi</span>
          </button>

          <!-- Mission -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('mission')"
          >
            <span class="text-sm">📄</span>
            <span>Nhiệm vụ</span>
          </button>

          <!-- Event -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('event')"
          >
            <span class="text-sm">📄</span>
            <span>Sự kiện</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('caught')"
          >
            <span class="text-sm" aria-hidden="true">🐟</span>
            <span>Kho cá</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('post-production')"
          >
            <span class="text-sm" aria-hidden="true">🕸️</span>
            <span>Lưới cá</span>
          </button>

          <!-- Redeem code -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('redeem')"
          >
            <span class="text-sm" aria-hidden="true">🎁</span>
            <span>Đổi mã</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="
              hasNewNotification = false;
              modalStore.open('notifications');
            "
          >
            <span class="text-sm" aria-hidden="true">🔔</span>
            <span>Thông báo</span>
            <span v-if="hasNewNotification" class="size-2 rounded-full bg-red-500" aria-label="Có thông báo mới"></span>
          </button>

          <button
            v-if="configStore.showFaction"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('faction')"
          >
            <span class="text-sm" aria-hidden="true">🛡️</span>
            <span>Phe phái</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('friend')"
          >
            <span class="text-sm" aria-hidden="true">👥</span>
            <span>Bạn bè</span>
          </button>

          <button
            v-if="configStore.showTeam"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('team')"
          >
            <span class="text-sm" aria-hidden="true">🎣</span>
            <span>Lập đội</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
            @click="modalStore.open('badge')"
          >
            <span class="text-sm" aria-hidden="true">🏆</span>
            <span>Huy hiệu</span>
          </button>
        </div>

        <LatestCaughtList />
      </div>
    </main>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-to-class="opacity-0"
      >
        <div v-if="modalStore.isModalOpening">
          <AccountInfoModal v-if="modalStore.isOpening('account')" />
          <MarketWindow v-if="modalStore.isOpening('market')" />
          <ShopModal v-if="modalStore.isOpening('shop')" />
          <CatchDiaryModal v-if="modalStore.isOpening('diary')" />
          <SpinWheelModal v-if="modalStore.isOpening('gacha')" />
          <InventoryModal v-if="modalStore.isOpening('inventory')" />
          <Feedbackmodal v-if="modalStore.isOpening('feedback')" />
          <MissionModal v-if="modalStore.isOpening('mission')" />
          <EventModal v-if="modalStore.isOpening('event')" />
          <RedeemCode v-if="modalStore.isOpening('redeem')" />
          <NotificationModal v-if="modalStore.isOpening('notifications')" />
          <CaughtModal v-if="modalStore.isOpening('caught')" />
          <FactionSelectModal v-if="modalStore.isOpening('faction')" />
          <FriendModal v-if="modalStore.isOpening('friend')" />
          <TeamModal v-if="modalStore.isOpening('team')" />
          <Achievement v-if="modalStore.isOpening('badge')" />
          <PostProduction v-if="modalStore.isOpening('post-production')" />
          <PrepareModal v-if="modalStore.isOpening('prepare')" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
