<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { defineAsyncComponent, onMounted, onUnmounted, watch } from "vue";
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
import FeatureTable from "./FeatureTable.vue";
import GuideTour from "../../shared/GuideTour.vue";
import { useOnboardingStore } from "../../../stores/onboarding";
import { useFeatureAvailabilityStore } from "../../../stores/featureAvailability";

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
const TutorialModal = defineAsyncComponent(() => import("../tutorial/TutorialModal.vue"));

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
const features = useFeatureAvailabilityStore();

const firstPlaySteps = [
  {
    target: "#first-play-account",
    get title() {
      return tr("Lobby.chao_mung_ban_den_voi_ho_cau");
    },
    get description() {
      return tr("Lobby.trong_tai_khoan_chon_ten_anh_dai_dien_va_quoc_gia_de_bat_dau_han");
    },
  },
  {
    target: "#first-play-inventory",
    get title() {
      return tr("Lobby.chuan_bi_trang_bi");
    },
    get description() {
      return tr("Lobby.mo_tui_do_va_chon_du_can_day_may_luoi_moi_trong_mot_set_vao_cua_");
    },
  },
  {
    target: "#first-play-map",
    get title() {
      return tr("Lobby.chon_bai_cau");
    },
    get description() {
      return tr("Lobby.mo_mot_quoc_gia_tren_ban_do_chon_bai_cau_roi_kiem_tra_trang_bi_t");
    },
  },
  {
    target: "#first-play-map",
    get title() {
      return tr("Lobby.tha_cau_va_keo_ca");
    },
    get description() {
      return tr("Lobby.o_bai_cau_chinh_do_sau_tha_can_va_cho_ca_can_lam_theo_huong_dan_");
    },
  },
  {
    target: "#first-play-storage",
    get title() {
      return tr("Lobby.giu_lai_thanh_qua");
    },
    get description() {
      return tr("Lobby.khi_ve_sanh_mo_luoi_ca_va_chuyen_ca_muon_giu_vao_kho_ca_ca_con_t");
    },
  },
  {
    target: "#first-play-market",
    get title() {
      return tr("Lobby.ban_ca_va_tiep_tuc_kham_pha");
    },
    get description() {
      return tr("Lobby.trong_kho_ca_ban_co_the_ban_ca_hoac_dang_len_cho_ca_tien_kiem_du");
    },
  },
];
watch(
  () => [authStore.user?.id, userProfileStore.profile?.onboarding_completed, modalStore.isModalOpening],
  () => {
    if (authStore.user?.id && !modalStore.isModalOpening) onboarding.offer(authStore.user.id);
  },
  { immediate: true },
);

watch(
  () => [authStore.user?.id, features.isAvailable("notifications")] as const,
  ([userId, enabled], _, onCleanup) => {
    if (userId && enabled) notificationStore.startRefreshing(userId, 'badge');
    onCleanup(() => {
      notificationStore.stopRefreshing('badge');
    });
  },
  { immediate: true },
);

watch(() => [authStore.user?.id, features.isAvailable('team')] as const, ([userId, enabled], _, onCleanup) => {
  if (!userId || !enabled) return;
  teamStore.startRefreshing(userId, 'lobby');
  onCleanup(() => teamStore.stopRefreshing('lobby'));
}, { immediate: true });

onMounted(() => {
  void userTurnsStore.fetchStatus().then(() => userTurnsStore.startCountdown());
  if (authStore.userId) {
    caughtStore.loadCaughtFishes();
  }
});

onUnmounted(() => {
  notificationStore.stopRefreshing('badge');
  userTurnsStore.stopCountdown();
});
</script>

<template>
  <div class="w-screen min-h-screen p-3 relative flex flex-col gap-2 overflow-hidden">
    <TeamMembersSticky
      v-if="features.isAvailable('team') && configStore.showTeam && teamStore.myTeamMembers.length"
      class="slide-fade-in from-right"
      :members="teamStore.myTeamMembers"
      @open-team="modalStore.open('team')"
    />
    <header
      class="slide-fade-in from-top flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2.5 text-[#24352a]"
    >
      <span class="font-bold">{{ tr("Lobby.tieu_de") }}</span>
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
      <div id="first-play-map">
        <InteractWorldMap2 collapsible />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div class="slide-fade-in from-bottom-left">
          <LatestCaughtList />
        </div>
        <FeatureTable />
      </div>
    </main>

    <div v-if="onboarding.error" role="alert" class="text-sm text-red-700">
      {{ onboarding.error }} <button class="underline" @click="onboarding.finish()">{{ tr("Lobby.luu_lai") }}</button>
    </div>
    <GuideTour
      v-if="onboarding.visible && !modalStore.isModalOpening"
      :steps="firstPlaySteps"
      @finish="onboarding.finish()"
    />
    <Teleport to="body">
      <Transition name="player-window" :duration="{ enter: 220, leave: 150 }">
        <div v-if="modalStore.isModalOpening">
          <AccountInfoModal v-if="modalStore.isOpening('account')" />
          <GuideModal v-if="modalStore.isOpening('guide')" />
          <TutorialModal v-if="modalStore.isOpening('tutorial')" />
          <MarketWindow v-if="configStore.isUnlocked('market') && modalStore.isOpening('market')" />
          <ShopModal v-if="modalStore.isOpening('shop')" />
          <CatchDiaryModal v-if="modalStore.isOpening('diary')" />
          <SpinWheelModal v-if="configStore.isUnlocked('gacha') && modalStore.isOpening('gacha')" />
          <InventoryModal v-if="modalStore.isOpening('inventory') || modalStore.isOpening('body')"
            :initial-tab="modalStore.isOpening('body') ? 'health' : 'fishing'" />
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
