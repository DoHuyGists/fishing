<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref, watch } from "vue";
import { useAuthStore } from "../../../stores/auth.ts";
import { useCaughtStore } from "../../../stores/caught.ts";
import { useModalStore } from "../../../stores/modal.ts";
import { useNotificationStore } from "../../../stores/notification.ts";
import LatestCaughtList from "../caught/LatestCaughtList.vue";
import { useConfigStore } from "../../../stores/config.ts";
import { useUserTurnsStore } from "../../../stores/userTurns.ts";
import { useTeamStore } from "../../../stores/team.ts";
import { useCurrencyStore } from "../../../stores/currency.ts";
import { useUserProfileStore } from "../../../stores/userProfile.ts";
import UserTurn from "../stamina/UserTurn.vue";
import Cash from "../currency/Cash.vue";
import Shells from "../currency/Shells.vue";
import Tickets from "../currency/Tickets.vue";
import SkillPoints from "../currency/SkillPoints.vue";
import TeamMembersSticky from "../team/TeamMembersSticky.vue";
import PrepareModal from "./PrepareModal.vue";
import Fishingfightdemo from "../fishing-challenge/TensionChallenge.vue";
import GuideTour from "../../shared/GuideTour.vue";
import { useOnboardingStore } from "../../../stores/onboarding";

const InteractWorldMap2 = defineAsyncComponent(() => import("./InteractWorldMap.vue"));
const AccountInfoModal = defineAsyncComponent(() => import("../account/AccountInfoModal.vue"));
const MarketWindow = defineAsyncComponent(() => import("../market/MarketWindow.vue"));
const ShopModal = defineAsyncComponent(() => import("../shop/ShopModal.vue"));
const CatchDiaryModal = defineAsyncComponent(() => import("../diary/CatchDiaryModal.vue"));
const SpinWheelModal = defineAsyncComponent(() => import("../spin-wheel/SpinWheelModal.vue"));
const InventoryModal = defineAsyncComponent(() => import("../inventory/InventoryModal.vue"));
const Feedbackmodal = defineAsyncComponent(() => import("../feedback/Feedbackmodal.vue"));
const MissionModal = defineAsyncComponent(() => import("../mission/MissionModal.vue"));
const EventModal = defineAsyncComponent(() => import("../event/EventModal.vue"));
const RedeemCode = defineAsyncComponent(() => import("../redeem-code/RedeemCodeModal.vue"));
const NotificationModal = defineAsyncComponent(() => import("../notification/NotificationModal.vue"));
const CaughtModal = defineAsyncComponent(() => import("../caught/CaughtModal.vue"));
const FactionSelectModal = defineAsyncComponent(() => import("../faction/FactionSelectModal.vue"));
const Achievement = defineAsyncComponent(() => import("../badge/Achievement.vue"));
const FriendModal = defineAsyncComponent(() => import("../friend/FriendModal.vue"));
const WorkBenchModal = defineAsyncComponent(() => import("../work-bench/WorkBenchModal.vue"));
const LeaderboardModal = defineAsyncComponent(() => import("../leaderboard/LeaderboardModal.vue"));
const TeamModal = defineAsyncComponent(() => import("../team/TeamModal.vue"));
const PostProduction = defineAsyncComponent(() => import("../fishing-post-production/PostProduction.vue"));
const AttendanceModal = defineAsyncComponent(() => import("../attendance/AttendanceModal.vue"));
const DonationModal = defineAsyncComponent(() => import("../donation/DonationModal.vue"));
const SkillModal = defineAsyncComponent(() => import("../skill/SkillModal.vue"));
const AquacultureModal = defineAsyncComponent(() => import("../aquaculture/AquacultureModal.vue"));
const GuideModal = defineAsyncComponent(() => import("../guide/GuideModal.vue"));

const authStore = useAuthStore();
const caughtStore = useCaughtStore();
const modalStore = useModalStore();
const notificationStore = useNotificationStore();
const configStore = useConfigStore();
const userTurnsStore = useUserTurnsStore();
const teamStore = useTeamStore();
const currencyStore = useCurrencyStore();
const userProfileStore = useUserProfileStore();
const onboarding = useOnboardingStore();
const firstPlaySteps = [
  { target: '#first-play-account', title: 'Chào mừng bạn đến với hồ câu', description: 'Trong Tài khoản, chọn tên, ảnh đại diện và quốc gia để bắt đầu hành trình.' },
  { target: '#first-play-inventory', title: 'Chuẩn bị trang bị', description: 'Mở Túi đồ và chọn đủ cần, dây, máy, lưỡi, mồi trong một set. Vào Cửa hàng nếu còn thiếu.' },
  { target: '#first-play-map', title: 'Chọn bãi câu', description: 'Mở một quốc gia trên bản đồ, chọn bãi câu rồi kiểm tra trang bị trước khi vào.' },
  { target: '#first-play-map', title: 'Thả câu và kéo cá', description: 'Ở bãi câu, chỉnh độ sâu, thả cần và chờ cá cắn. Làm theo hướng dẫn thử thách để kéo cá lên.' },
  { target: '#first-play-storage', title: 'Giữ lại thành quả', description: 'Khi về sảnh, mở Lưới cá và chuyển cá muốn giữ vào Kho cá. Cá còn trong lưới sẽ được thả khi bạn chọn Kết thúc.' },
  { target: '#first-play-market', title: 'Bán cá và tiếp tục khám phá', description: 'Trong Kho cá, bạn có thể bán cá hoặc đăng lên Chợ cá. Tiền kiếm được dùng mua trang bị và nguyên liệu tốt hơn.' },
];
watch(() => [authStore.user?.id, userProfileStore.profile?.onboarding_completed, modalStore.isModalOpening], () => {
  if (authStore.user?.id && !modalStore.isModalOpening) onboarding.offer(authStore.user.id);
}, { immediate: true });


const MAP_VISIBLE_STORAGE_KEY = "worldMap2Visible";
const isMapVisible = ref(localStorage.getItem(MAP_VISIBLE_STORAGE_KEY) !== "false");
watch(isMapVisible, (value) => localStorage.setItem(MAP_VISIBLE_STORAGE_KEY, String(value)));

onMounted(() => {
  void userTurnsStore.fetchStatus().then(() => userTurnsStore.startCountdown());
  if (authStore.userId) {
    caughtStore.loadCaughtFishes();
    void teamStore.loadData(authStore.userId);
    teamStore.subscribeRealtime(authStore.userId);
    notificationStore.subscribeToNewNotifications(authStore.userId, () => {
    });
  }
});

onUnmounted(() => {
  void notificationStore.unsubscribeFromNewNotifications();
  teamStore.unsubscribeRealtime();
  userTurnsStore.stopCountdown();
});
</script>

<template>
  <div class="w-screen min-h-screen p-3 relative flex flex-col gap-2 overflow-x-hidden">
    <TeamMembersSticky
      v-if="configStore.showTeam && teamStore.myTeamMembers.length"
      :members="teamStore.myTeamMembers"
      @open-team="modalStore.open('team')"
    />
    <header
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2.5 text-[#24352a]"
    >
      <span class="font-bold">Bản đồ thế giới</span>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <Cash :amount="currencyStore.formattedCash" />
        <Shells :amount="currencyStore.formattedShells" />
        <Tickets :amount="currencyStore.formattedTickets" />
        <SkillPoints :amount="userProfileStore.skillPoints" />
        <UserTurn />
      </div>
    </header>

    <main class="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2">
      <!-- Khung Bản đồ trung tâm -->
      <div id="first-play-map" class="">
        <button
          type="button"
          class="mb-2 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] font-bold text-xs cursor-pointer"
          @click="isMapVisible = !isMapVisible"
        >
          {{ isMapVisible ? "🙈 Ẩn bản đồ" : "🗺️ Hiện bản đồ" }}
        </button>
        <InteractWorldMap2 v-if="isMapVisible" />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <LatestCaughtList />
        </div>
        <div>
          <div
            class="flex items-center flex-wrap gap-x-2 gap-y-4 pt-2 [&_button:disabled]:relative [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-60"
          >
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              id="first-play-account"
              @click="modalStore.open('account')"
            >
              <span class="text-sm">⚙️</span>
              <span>Tài khoản</span>
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              @click="modalStore.open('guide')"
            >
              <span class="text-sm" aria-hidden="true">📖</span>
              <span>Chỉ dẫn cơ bản</span>
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              :disabled="!configStore.isUnlocked('market')"
              id="first-play-market"
              @click="modalStore.open('market')"
            >
              <span class="text-sm">🏪</span>
              <span>Chợ cá</span>
              <span
                v-if="!configStore.isUnlocked('market')"
                class="absolute -top-2 -right-1 whitespace-nowrap rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-1.5 py-0.5 text-[9px] leading-none text-[#24352a] shadow-sm"
                >🔒 Cấp {{ configStore.requiredLevel("market") }}</span
              >
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              @click="modalStore.open('shop')"
            >
              <span class="text-sm" aria-hidden="true">🎁</span>
              <span>Cửa hàng</span>
            </button>
  
            <!-- Nhật ký -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              @click="modalStore.open('diary')"
            >
              <span class="text-sm">📖</span>
              <span>Nhật ký</span>
            </button>
  
            <!-- Gacha -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              :disabled="!configStore.isUnlocked('gacha')"
              @click="modalStore.open('gacha')"
            >
              <span class="text-sm">🎁</span>
              <span>Gacha</span>
              <span
                v-if="!configStore.isUnlocked('gacha')"
                class="absolute -top-2 -right-1 whitespace-nowrap rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-1.5 py-0.5 text-[9px] leading-none text-[#24352a] shadow-sm"
                >🔒 Cấp {{ configStore.requiredLevel("gacha") }}</span
              >
            </button>
  
            <!-- Túi đồ -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              id="first-play-inventory"
              @click="modalStore.open('inventory')"
            >
              <span class="text-sm">📦</span>
              <span>Túi đồ</span>
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              @click="modalStore.open('skill')"
            >
              <span class="text-sm" aria-hidden="true">✨</span>
              <span>Kỹ năng</span>
            </button>
  
            <!-- Feedback -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              @click="modalStore.open('feedback')"
            >
              <span class="text-sm">📄</span>
              <span>Phản hồi</span>
            </button>
  
            <!-- Mission -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              @click="modalStore.open('mission')"
            >
              <span class="text-sm">📄</span>
              <span>Nhiệm vụ</span>
            </button>
  
            <!-- Attendance -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              @click="modalStore.open('attendance')"
            >
              <span class="text-sm" aria-hidden="true">📅</span>
              <span>Điểm danh</span>
            </button>
  
            <!-- Event -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              :disabled="!configStore.isUnlocked('event')"
              @click="modalStore.open('event')"
            >
              <span class="text-sm">📄</span>
              <span>Sự kiện</span>
              <span
                v-if="!configStore.isUnlocked('event')"
                class="absolute -top-2 -right-1 whitespace-nowrap rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-1.5 py-0.5 text-[9px] leading-none text-[#24352a] shadow-sm"
                >🔒 Cấp {{ configStore.requiredLevel("event") }}</span
              >
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              id="first-play-storage"
              @click="modalStore.open('caught')"
            >
              <span class="text-sm" aria-hidden="true">🐟</span>
              <span>Kho cá</span>
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              :disabled="!configStore.isUnlocked('post-production')"
              @click="modalStore.open('post-production')"
            >
              <span class="text-sm" aria-hidden="true">🕸️</span>
              <span>Lưới cá</span>
              <span
                v-if="!configStore.isUnlocked('post-production')"
                class="absolute -top-2 -right-1 whitespace-nowrap rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-1.5 py-0.5 text-[9px] leading-none text-[#24352a] shadow-sm"
                >🔒 Cấp {{ configStore.requiredLevel("post-production") }}</span
              >
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              @click="modalStore.open('aquaculture')"
            >
              <span class="text-sm" aria-hidden="true">🐠</span>
              <span>Nông trại cá</span>
            </button>

            <!-- Redeem code -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              @click="modalStore.open('redeem')"
            >
              <span class="text-sm" aria-hidden="true">🎁</span>
              <span>Đổi mã</span>
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              @click="
                modalStore.open('notifications');
              "
            >
              <span class="text-sm" aria-hidden="true">🔔</span>
              <span>Thông báo</span>
              <span v-if="notificationStore.unreadCount" class="rounded-full bg-red-600 px-1.5 text-[10px] text-white" :aria-label="`${notificationStore.unreadCount} thông báo chưa đọc`">{{ notificationStore.unreadCount }}</span>
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              :disabled="!configStore.isUnlocked('faction')"
              @click="modalStore.open('faction')"
            >
              <span class="text-sm" aria-hidden="true">🛡️</span>
              <span>Phe phái</span>
              <span
                v-if="!configStore.isUnlocked('faction')"
                class="absolute -top-2 -right-1 whitespace-nowrap rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-1.5 py-0.5 text-[9px] leading-none text-[#24352a] shadow-sm"
                >🔒 Cấp {{ configStore.requiredLevel("faction") }}</span
              >
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              :disabled="!configStore.isUnlocked('friend')"
              @click="modalStore.open('friend')"
            >
              <span class="text-sm" aria-hidden="true">👥</span>
              <span>Bạn bè</span>
              <span
                v-if="!configStore.isUnlocked('friend')"
                class="absolute -top-2 -right-1 whitespace-nowrap rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-1.5 py-0.5 text-[9px] leading-none text-[#24352a] shadow-sm"
                >🔒 Cấp {{ configStore.requiredLevel("friend") }}</span
              >
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              :disabled="!configStore.isUnlocked('team')"
              @click="modalStore.open('team')"
            >
              <span class="text-sm" aria-hidden="true">🎣</span>
              <span>Lập đội</span>
              <span
                v-if="!configStore.isUnlocked('team')"
                class="absolute -top-2 -right-1 whitespace-nowrap rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-1.5 py-0.5 text-[9px] leading-none text-[#24352a] shadow-sm"
                >🔒 Cấp {{ configStore.requiredLevel("team") }}</span
              >
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              :disabled="!configStore.isUnlocked('badge')"
              @click="modalStore.open('badge')"
            >
              <span class="text-sm" aria-hidden="true">🏆</span>
              <span>Huy hiệu</span>
              <span
                v-if="!configStore.isUnlocked('badge')"
                class="absolute -top-2 -right-1 whitespace-nowrap rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-1.5 py-0.5 text-[9px] leading-none text-[#24352a] shadow-sm"
                >🔒 Cấp {{ configStore.requiredLevel("badge") }}</span
              >
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              :disabled="!configStore.isUnlocked('work-bench')"
              @click="modalStore.open('work-bench')"
            >
              <span class="text-sm" aria-hidden="true">🛠️</span>
              <span>Chế tạo</span>
              <span
                v-if="!configStore.isUnlocked('work-bench')"
                class="absolute -top-2 -right-1 whitespace-nowrap rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-1.5 py-0.5 text-[9px] leading-none text-[#24352a] shadow-sm"
                >🔒 Cấp {{ configStore.requiredLevel("work-bench") }}</span
              >
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              :disabled="!configStore.isUnlocked('leaderboard')"
              @click="modalStore.open('leaderboard')"
            >
              <span class="text-sm" aria-hidden="true">📊</span>
              <span>Xếp hạng</span>
              <span
                v-if="!configStore.isUnlocked('leaderboard')"
                class="absolute -top-2 -right-1 whitespace-nowrap rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-1.5 py-0.5 text-[9px] leading-none text-[#24352a] shadow-sm"
                >🔒 Cấp {{ configStore.requiredLevel("leaderboard") }}</span
              >
            </button>
  
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] shadow-sm font-bold text-xs cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
              :disabled="!configStore.isUnlocked('donation')"
              @click="modalStore.open('donation')"
            >
              <span aria-hidden="true">💚</span>
              <span>Ủng hộ</span>
              <span
                v-if="!configStore.isUnlocked('donation')"
                class="absolute -top-2 -right-1 whitespace-nowrap rounded-full border border-[#cbd9c6] bg-[#f5f9f0] px-1.5 py-0.5 text-[9px] leading-none text-[#24352a] shadow-sm"
                >🔒 Cấp {{ configStore.requiredLevel("donation") }}</span
              >
            </button>
          </div>
        </div>
      </div>
    </main>

    <p v-if="onboarding.error" role="alert" class="text-sm text-red-700">{{ onboarding.error }} <button class="underline" @click="onboarding.finish()">Lưu lại</button></p>
    <GuideTour v-if="onboarding.visible && !modalStore.isModalOpening" :steps="firstPlaySteps" @finish="onboarding.finish()" />
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-to-class="opacity-0"
      >
        <div v-if="modalStore.isModalOpening">
          <AccountInfoModal v-if="modalStore.isOpening('account')" />
          <GuideModal v-if="modalStore.isOpening('guide')" />
          <MarketWindow v-if="configStore.isUnlocked('market') && modalStore.isOpening('market')" />
          <ShopModal v-if="modalStore.isOpening('shop')" />
          <CatchDiaryModal v-if="modalStore.isOpening('diary')" />
          <SpinWheelModal v-if="configStore.isUnlocked('gacha') && modalStore.isOpening('gacha')" />
          <InventoryModal v-if="modalStore.isOpening('inventory')" />
          <SkillModal v-if="modalStore.isOpening('skill')" />
          <AquacultureModal v-if="modalStore.isOpening('aquaculture')" />
          <Feedbackmodal v-if="modalStore.isOpening('feedback')" />
          <MissionModal v-if="modalStore.isOpening('mission')" />
          <EventModal v-if="configStore.isUnlocked('event') && modalStore.isOpening('event')" />
          <RedeemCode v-if="modalStore.isOpening('redeem')" />
          <NotificationModal v-if="modalStore.isOpening('notifications')" />
          <CaughtModal v-if="modalStore.isOpening('caught')" />
          <FactionSelectModal v-if="configStore.isUnlocked('faction') && modalStore.isOpening('faction')" />
          <FriendModal v-if="configStore.isUnlocked('friend') && modalStore.isOpening('friend')" />
          <TeamModal v-if="configStore.isUnlocked('team') && modalStore.isOpening('team')" />
          <Achievement v-if="configStore.isUnlocked('badge') && modalStore.isOpening('badge')" />
          <WorkBenchModal v-if="configStore.isUnlocked('work-bench') && modalStore.isOpening('work-bench')" />
          <LeaderboardModal v-if="configStore.isUnlocked('leaderboard') && modalStore.isOpening('leaderboard')" />
          <AttendanceModal v-if="modalStore.isOpening('attendance')" />
          <DonationModal v-if="configStore.isUnlocked('donation') && modalStore.isOpening('donation')" />
          <PostProduction v-if="configStore.isUnlocked('post-production') && modalStore.isOpening('post-production')" />
          <PrepareModal v-if="modalStore.isOpening('prepare')" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
