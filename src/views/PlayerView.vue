<script setup lang="ts">
import { t as tr } from "../i18n/index.ts";

import { defineAsyncComponent, onMounted, onUnmounted, watch } from "vue";
import { useAuthStore } from "../stores/auth.ts";
import { useCaughtStore } from "../stores/player-caught-store.ts";
import { useModalStore } from "../stores/player-modal-store.ts";
import { useNotificationStore } from "../stores/player-notification-store.ts";
import LatestCaughtList from "../components/player/player-world-map/LatestCaughtList.vue";
import { useConfigStore } from "../stores/player-config-store.ts";
import { useUserTurnsStore } from "../stores/player-user-turns-store.ts";
import { useTeamStore } from "../stores/player-team-store.ts";
import { useCurrencyStore } from "../stores/player-currency-store.ts";
import { useUserProfileStore } from "../stores/player-user-profile-store.ts";
import UserTurn from "../components/player/player-stamina/UserTurn.vue";
import Cash from "../components/player/player-currency/Cash.vue";
import Shells from "../components/player/player-currency/Shells.vue";
import Tickets from "../components/player/player-currency/Tickets.vue";
import SkillPoints from "../components/player/player-currency/SkillPoints.vue";
import TeamMembersSticky from "../components/player/player-team/TeamMembersSticky.vue";
import PrepareModal from "../components/player/player-prepare/PrepareModal.vue";
import FeatureTable from "../components/player/player-world-map/FeatureTable.vue";
import GuideTour from "../components/shared/GuideTour.vue";
import { useOnboardingStore } from "../stores/player-onboarding-store.ts";
import { useFeatureAvailabilityStore } from "../stores/player-feature-availability-store.ts";

const InteractWorldMap2 = defineAsyncComponent(
  () => import("../components/player/player-world-map/InteractWorldMap.vue"),
);
const AccountInfoModal = defineAsyncComponent(() => import("../components/player/player-account/AccountInfoModal.vue"));
const MarketModal = defineAsyncComponent(() => import("../components/player/player-market/MarketModal.vue"));
const ShopModal = defineAsyncComponent(() => import("../components/player/player-shop/ShopModal.vue"));
const CatchDiaryModal = defineAsyncComponent(() => import("../components/player/player-diary/CatchDiaryModal.vue"));
const SpinWheelModal = defineAsyncComponent(() => import("../components/player/player-spin-wheel/SpinWheelModal.vue"));
const StorageModal = defineAsyncComponent(() => import("../components/player/player-inventory/StorageModal.vue"));
const EquipmentModal = defineAsyncComponent(() => import("../components/player/player-inventory/EquipmentModal.vue"));
const Feedbackmodal = defineAsyncComponent(() => import("../components/player/player-feedback/Feedbackmodal.vue"));
const MissionModal = defineAsyncComponent(() => import("../components/player/player-mission/MissionModal.vue"));
const EventModal = defineAsyncComponent(() => import("../components/player/player-event/EventModal.vue"));
const RedeemCode = defineAsyncComponent(() => import("../components/player/player-redeem-code/RedeemCodeModal.vue"));
const NotificationModal = defineAsyncComponent(
  () => import("../components/player/player-notification/NotificationModal.vue"),
);
const CaughtModal = defineAsyncComponent(() => import("../components/player/player-caught/CaughtModal.vue"));
const FactionSelectModal = defineAsyncComponent(
  () => import("../components/player/player-faction/FactionSelectModal.vue"),
);
const Achievement = defineAsyncComponent(() => import("../components/player/player-badge/Achievement.vue"));
const FriendModal = defineAsyncComponent(() => import("../components/player/player-friend/FriendModal.vue"));
const WorkBenchModal = defineAsyncComponent(() => import("../components/player/player-work-bench/WorkBenchModal.vue"));
const LeaderboardModal = defineAsyncComponent(
  () => import("../components/player/player-leaderboard/LeaderboardModal.vue"),
);
const TeamModal = defineAsyncComponent(() => import("../components/player/player-team/TeamModal.vue"));
const PostProduction = defineAsyncComponent(() => import("../components/player/player-fishing-net/PostProduction.vue"));
const AttendanceModal = defineAsyncComponent(
  () => import("../components/player/player-attendance/AttendanceModal.vue"),
);
const DonationModal = defineAsyncComponent(() => import("../components/player/player-donation/DonationModal.vue"));
const SkillModal = defineAsyncComponent(() => import("../components/player/player-skill/SkillModal.vue"));
const AquacultureModal = defineAsyncComponent(
  () => import("../components/player/player-aquaculture/AquacultureModal.vue"),
);
const DispatchModal = defineAsyncComponent(() => import("../components/player/player-dispatch/DispatchModal.vue"));
const FishingMapModal = defineAsyncComponent(
  () => import("../components/player/player-fishing-map/FishingMapModal.vue"),
);
const GuideModal = defineAsyncComponent(() => import("../components/player/player-guide/GuideModal.vue"));
const RuleModal = defineAsyncComponent(() => import("../components/player/player-rule/RuleModal.vue"));
const TutorialModal = defineAsyncComponent(() => import("../components/player/player-tutorial/TutorialModal.vue"));
const StoryModal = defineAsyncComponent(() => import("../components/story/StoryModal.vue"));

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
    if (userId && enabled) notificationStore.startRefreshing(userId, "badge");
    onCleanup(() => {
      notificationStore.stopRefreshing("badge");
    });
  },
  { immediate: true },
);

watch(
  () => [authStore.user?.id, features.isAvailable("team")] as const,
  ([userId, enabled], _, onCleanup) => {
    if (!userId || !enabled) return;
    teamStore.startRefreshing(userId, "lobby");
    onCleanup(() => teamStore.stopRefreshing("lobby"));
  },
  { immediate: true },
);

onMounted(() => {
  const cancelRestoration = modalStore.scheduleRestoration();
  onUnmounted(cancelRestoration);
  void userTurnsStore.fetchStatus().then(() => userTurnsStore.startCountdown());
  if (authStore.userId) {
    caughtStore.loadCaughtFishes();
  }
});

onUnmounted(() => {
  notificationStore.stopRefreshing("badge");
  userTurnsStore.stopCountdown();
});
</script>

<template>
  <div :style="{backgroundImage: 'url(/lobby_bg.png)', backgroundRepeat: 'no-repeat', backgroundSize: 'cover'}" class="w-screen min-h-screen p-3 relative flex flex-col gap-2 overflow-hidden bg-[var(--color-ocean-deep)] bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,_var(--color-sky)_12%,_transparent),transparent_65%)] text-content">
    <TeamMembersSticky
      v-if="features.isAvailable('team') && configStore.showTeam && teamStore.myTeamMembers.length"
      class="slide-fade-in from-right"
      :members="teamStore.myTeamMembers"
      @open-team="modalStore.open('team')"
    />
    <header
      class="slide-fade-in from-top flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-ocean-gold)]/60 bg-[linear-gradient(115deg,var(--color-ocean-panel),var(--color-ocean-deep))] px-4 py-3 text-content shadow-[0_6px_20px_color-mix(in_srgb,_var(--color-content)_20%,_transparent),inset_0_1px_0_color-mix(in_srgb,_var(--color-surface)_8%,_transparent)]"
    >
      <span class="font-bold tracking-wide text-accent">{{ tr("Lobby.tieu_de") }}</span>
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
        <div class="slide-fade-in from-top-right">
          <LatestCaughtList />
        </div>
        <div class="slide-fade-in from-right">
          <FeatureTable />
        </div>
      </div>
    </main>

    <div v-if="onboarding.error" role="alert" class="text-sm text-danger">
      {{ onboarding.error }} <button class="underline" @click="onboarding.finish()">{{ tr("Lobby.luu_lai") }}</button>
    </div>
    <GuideTour
      v-if="onboarding.visible && !modalStore.isModalOpening"
      :steps="firstPlaySteps"
      @finish="onboarding.finish()"
    />
    <Teleport to="body">
      <Transition name="player-window" :css="!modalStore.restoredEntrance" :duration="{ enter: 220, leave: 220 }">
        <div v-if="modalStore.isModalOpening && !modalStore.restorationPending">
          <AccountInfoModal v-if="modalStore.isOpening('account')" />
          <GuideModal v-if="modalStore.isOpening('guide')" />
          <RuleModal v-if="modalStore.isOpening('rule')" />
          <TutorialModal v-if="modalStore.isOpening('tutorial')" />
          <StoryModal v-if="modalStore.isOpening('story')" />
          <MarketModal v-if="configStore.isUnlocked('market') && modalStore.isOpening('market')" />
          <ShopModal v-if="modalStore.isOpening('shop')" />
          <CatchDiaryModal v-if="modalStore.isOpening('diary')" />
          <SpinWheelModal v-if="configStore.isUnlocked('gacha') && modalStore.isOpening('gacha')" />
          <StorageModal v-if="modalStore.isOpening('storage')" />
          <EquipmentModal
            v-if="modalStore.isOpening('inventory') || modalStore.isOpening('body')"
            :key="modalStore.modalOpening ?? 'inventory'"
            :initial-tab="modalStore.isOpening('body') ? 'health' : 'fishing'"
          />
          <SkillModal v-if="modalStore.isOpening('skill')" />
          <AquacultureModal v-if="modalStore.isOpening('aquaculture')" />
          <DispatchModal v-if="modalStore.isOpening('dispatch')" />
          <FishingMapModal v-if="modalStore.isOpening('fishing-map')" />
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
