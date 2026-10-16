<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useCurrencyStore } from "../../stores/currency.ts";
import { useAuthStore } from "../../stores/auth.ts";
import InteractWorldWrapper from "./InteractWorldMap.vue";
import MarketWindow from "../market/MarketWindow.vue";
import { useCaughtStore } from "../../stores/caught.ts";
import CaughtList from "../caught/CaughtList.vue";
import CatchDiaryModal from "../diary/CatchDiaryModal.vue";
import AccountInfoModal from "../account/AccountInfoModal.vue";
import SpinWheelModal from "../spin-wheel/SpinWheelModal.vue";
import InventoryModal from "../inventory/InventoryModal.vue";
import Feedbackmodal from "../feedback/Feedbackmodal.vue";
import MissionModal from "../mission/MissionModal.vue";
import EventModal from "../event/EventModal.vue";
import RedeemCode from "../redeem-code/RedeemCode.vue";
import NotificationModal from "../notification/NotificationModal.vue";
import FactionSelectModal from "../faction/FactionSelectModal.vue";
import FriendModal from "../friend/FriendModal.vue";
import TeamModal from "../team/TeamModal.vue";
import PostProduction from "../fishing-post-production/PostProduction.vue";
import { useModalStore } from "../../stores/modal.ts";
import { useNotificationStore } from "../../stores/notification";
import LatestCaughtList from "../caught/LatestCaughtList.vue";

const authStore = useAuthStore();
const caughtStore = useCaughtStore();
const modalStore = useModalStore();
const notificationStore = useNotificationStore();

const hasNewNotification = ref(false);


onMounted(() => {
  if (authStore.userId) {
    caughtStore.loadCaughtFishes();
    notificationStore.subscribeToNewNotifications(authStore.userId, () => {
      hasNewNotification.value = true;
    });
  }
});

onUnmounted(() => {
  void notificationStore.unsubscribeFromNewNotifications();
});

</script>

<template>
  <div class="w-screen h-screen p-3 relative grid grid-cols-1 md:grid-cols-2 gap-2 overflow-x-hidden">

    <!-- Khung Bản đồ trung tâm -->
     <div class="">

       <InteractWorldWrapper />
     </div>
        
    <div class="">
      <div class="flex items-center flex-wrap gap-2">
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('account')">
          <span class="text-sm">⚙️</span>
          <span>Tài khoản</span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('market')">
          <span class="text-sm">🏪</span>
          <span>Chợ cá</span>
        </button>

        <!-- Nhật ký -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('diary')">
          <span class="text-sm">📖</span>
          <span>Nhật ký</span>
        </button>

        <!-- Gacha -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('gacha')">
          <span class="text-sm">🎁</span>
          <span>Gacha</span>
        </button>

        <!-- Túi đồ -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('inventory')">
          <span class="text-sm">📦</span>
          <span>Túi đồ</span>
        </button>

        <!-- Feedback -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('feedback')">
          <span class="text-sm">📄</span>
          <span>Phản hồi</span>
        </button>

        <!-- Mission -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('mission')">
          <span class="text-sm">📄</span>
          <span>Nhiệm vụ</span>
        </button>

        <!-- Event -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('event')">
          <span class="text-sm">📄</span>
          <span>Sự kiện</span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('caught')">
          <span class="text-sm" aria-hidden="true">🐟</span>
          <span>Kho cá</span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('post-production')">
          <span class="text-sm" aria-hidden="true">🕸️</span>
          <span>Lưới cá</span>
        </button>

        <!-- Redeem code -->
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('redeem')">
          <span class="text-sm" aria-hidden="true">🎁</span>
          <span>Đổi mã</span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="hasNewNotification = false; modalStore.open('notifications')">
          <span class="text-sm" aria-hidden="true">🔔</span>
          <span>Thông báo</span>
          <span v-if="hasNewNotification" class="size-2 rounded-full bg-red-500" aria-label="Có thông báo mới"></span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('faction')">
          <span class="text-sm" aria-hidden="true">🛡️</span>
          <span>Phe phái</span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('friend')">
          <span class="text-sm" aria-hidden="true">👥</span>
          <span>Bạn bè</span>
        </button>

        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border border-gray-300 text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="modalStore.open('team')">
          <span class="text-sm" aria-hidden="true">🎣</span>
          <span>Lập đội</span>
        </button>
      </div>

      <LatestCaughtList/>
    </div>

    <Teleport to="body">
      <Transition enter-active-class="transition-opacity duration-200 ease-out" enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150 ease-in" leave-to-class="opacity-0">
        <div v-if="modalStore.isModalOpening">
          <AccountInfoModal v-if="modalStore.isOpening('account')" />
          <MarketWindow v-if="modalStore.isOpening('market')"/>
          <CatchDiaryModal v-if="modalStore.isOpening('diary')"/>
          <SpinWheelModal v-if="modalStore.isOpening('gacha')"/>
          <InventoryModal v-if="modalStore.isOpening('inventory')"/>
          <Feedbackmodal v-if="modalStore.isOpening('feedback')"/>
          <MissionModal v-if="modalStore.isOpening('mission')"/>
          <EventModal v-if="modalStore.isOpening('event')"/>
          <RedeemCode v-if="modalStore.isOpening('redeem')" />
          <NotificationModal v-if="modalStore.isOpening('notifications')" />
          <CaughtList v-if="modalStore.isOpening('caught')" />
          <FactionSelectModal v-if="modalStore.isOpening('faction')" />
          <FriendModal v-if="modalStore.isOpening('friend')" />
          <TeamModal v-if="modalStore.isOpening('team')" />
          <PostProduction v-if="modalStore.isOpening('post-production')" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>