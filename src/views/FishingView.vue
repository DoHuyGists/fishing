<script setup lang="ts">
import { t as tr } from "../i18n";

import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import EquipmentMenu from "../components/player/fishing/EquipmentMenu.vue";
import CatchDialog from "../components/player/fishing/CatchDialog.vue";
import FishingBag from "../components/player/fishing/FishingBag.vue";
import FishingPlayers from "../components/player/fishing/FishingPlayers.vue";
import FishingScene from "../components/player/fishing/FishingScene.vue";
import LakeFishGuide from "../components/player/fishing/LakeFishGuide.vue";
import Loading from "../components/Loading.vue";
import TensionChallenge from "../components/player/fishing-challenge/TensionChallenge.vue";
import { useFishingStore } from "../stores/fishing";
import { useAuthStore } from "../stores/auth";
import { useEquipmentStore } from "../stores/equipment";
import { useUserSettingStore } from "../stores/userSetting";
import { useFishingBackgroundSoundStore } from "../stores/fishingBackgroundSound";
import DayPhaseClock from "../components/player/fishing/DayPhaseClock.vue";
import { useDayPhaseStore } from "../stores/dayPhase";
import { useUserInAreaStore } from "../stores/userInArea";
import { supabaseFishingAreaRepository } from "../data/supabaseFishingAreaRepository";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { FishingSceneContext } from "../data/fishingGameplay";

const authStore = useAuthStore();
const router = useRouter();
const fishingStore = useFishingStore();
const equipmentStore = useEquipmentStore();
const userSettingStore = useUserSettingStore();
const backgroundSoundStore = useFishingBackgroundSoundStore();
const dayPhaseStore = useDayPhaseStore();
const userInAreaStore = useUserInAreaStore();
const { user } = storeToRefs(authStore);
const { sessionReady, sessionError } = storeToRefs(fishingStore);
const equipmentCollapsed = ref(true);
const settingsOpen = ref(false);
const showExitConfirmation = ref(false);
const sceneContext = computed<FishingSceneContext>(() => ({
  state: fishingStore,
  sceneImage: dayPhaseStore.currentScenePhace,
  rodImage:
    equipmentStore.variants.rod.find((rod) => rod.id === fishingStore.equipmentLoadout.rod)?.image ||
    "/fishing-rob.png",
}));
let fishingSessionSubscription: RealtimeChannel | null = null;
let subscribedSessionId: string | null = null;
let handledBiteSessionId: string | null = null;

function unsubscribeFishingSession() {
  subscribedSessionId = null;
  handledBiteSessionId = null;
  if (fishingSessionSubscription) {
    void supabaseFishingAreaRepository.unsubscribe(fishingSessionSubscription);
    fishingSessionSubscription = null;
  }
}

watch(
  () => (sessionReady.value ? fishingStore.sessionId : null),
  (sessionId) => {
    unsubscribeFishingSession();
    if (!sessionId) return;
    subscribedSessionId = sessionId;
    fishingSessionSubscription = supabaseFishingAreaRepository.subscribeToFishingSession(sessionId, (session) => {
      if (subscribedSessionId !== sessionId || handledBiteSessionId === sessionId) return;
      handledBiteSessionId = sessionId;
      void fishingStore.startChallengeForSession(session.id);
    });
  },
  { immediate: true },
);

watch(
  () => fishingStore.currentArea,
  (area) => dayPhaseStore.setCurrentScenePhase(area),
  { immediate: true },
);

watch(
  () => fishingStore.leaveAreaError,
  (error) => {
    if (error) showExitConfirmation.value = true;
  },
);

watch(sessionReady, (ready) => {
  if (!ready) showExitConfirmation.value = false;
});

function toggleEquipment() {
  equipmentCollapsed.value = !equipmentCollapsed.value;
}

function retrySetup() {
  if (user.value) void fishingStore.initializeSession(user.value.id);
}

watch(
  () => user.value?.id,
  (userId) => {
    backgroundSoundStore.stop();
    void userSettingStore.load(userId ?? null);
    if (userId) void fishingStore.initializeSession(userId);
    else {
      fishingStore.resetSession();
      equipmentStore.reset();
    }
  },
  { immediate: true },
);

watch(
  () => sessionReady.value && userSettingStore.ready && userSettingStore.isFishingBackgroundSoundTurnOn,
  (enabled) => {
    if (enabled) backgroundSoundStore.start();
    else backgroundSoundStore.stop();
  },
  { immediate: true, flush: "sync" },
);

onBeforeRouteLeave(async (to) => {
  if (to.name === "fishing" || !user.value) return true;
  return fishingStore.leaveFishingArea();
});

function preventZoomShortcut(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && ["+", "=", "-", "0"].includes(event.key)) event.preventDefault();
}

function preventZoomWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) event.preventDefault();
}

function preventGesture(event: Event) {
  event.preventDefault();
}

onMounted(() => {
  window.addEventListener("keydown", preventZoomShortcut);
  window.addEventListener("wheel", preventZoomWheel, { passive: false });
  document.addEventListener("gesturestart", preventGesture, { passive: false });
  document.addEventListener("gesturechange", preventGesture, { passive: false });
  document.addEventListener("gestureend", preventGesture, { passive: false });
});

onBeforeUnmount(() => {
  unsubscribeFishingSession();
  backgroundSoundStore.stop();
  fishingStore.resetSession();
  equipmentStore.reset();
  window.removeEventListener("keydown", preventZoomShortcut);
  window.removeEventListener("wheel", preventZoomWheel);
  document.removeEventListener("gesturestart", preventGesture);
  document.removeEventListener("gesturechange", preventGesture);
  document.removeEventListener("gestureend", preventGesture);
});
</script>

<template>
  <Loading v-if="!sessionReady && !sessionError" :text="tr('FishingView.dang_chuan_bi_du_lieu_cau_ca')" />
  <section
    v-else-if="!sessionReady"
    class="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f9f0] px-6 text-center text-[#24352a]"
    role="alert"
  >
    <div>{{ tr('FishingView.khong_the_chuan_bi_phien_cau') }} {{ sessionError }}</div>
    <button
      type="button"
      class="rounded-lg border border-[#cbd9c6] bg-white px-4 py-2 font-medium hover:bg-[#f5f9f0]"
      @click="retrySetup"
    >
      {{ tr('Maintenance.thu_lai') }}
    </button>
    <button
      type="button"
      class="rounded-lg border border-[#cbd9c6] bg-white px-4 py-2 font-medium hover:bg-[#f5f9f0] disabled:opacity-50"
      :disabled="fishingStore.isLeavingArea"
      @click="router.push({ name: 'home' })"
    >
      {{ tr('FishingView.quay_lai_ban_do') }}
    </button>
  </section>
  <main v-else class="w-full h-screen overflow-hidden touch-none overscroll-none bg-[#193224] text-[#e9f4e8]">
    <div class="fixed top-3 left-3 z-20 text-white flex justify-between items-start">
      <div class="flex flex-col gap-2">
        <DayPhaseClock :area-id="userInAreaStore.userInArea?.area_id" />
        <div class="backdrop-blur-2xl h-fit w-fit rounded p-1">
          <button
            type="button"
            class="text-sm text-red-500 bg-transparent border-0 cursor-pointer font-medium p-0 hover:underline disabled:opacity-50"
            :disabled="fishingStore.isLeavingArea"
            @click="showExitConfirmation = true"
          >
            {{ fishingStore.isLeavingArea ? tr('FishingView.dang_quay_lai') : tr('FishingView.ket_thuc_chuyen_cau') }}
          </button>
        </div>
      </div>
    </div>
    <button
      type="button"
      class="fixed right-3 top-3 z-20 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-1.5 text-xs font-bold text-[#24352a] hover:bg-[#e2ecdc]"
      aria-haspopup="dialog"
      @click="settingsOpen = true"
    >
      {{ tr('FishingView.cai_dat') }}
    </button>
    <div class="grid grid-rows-[minmax(0,1fr)_auto] w-full h-dvh">
      <FishingScene :context="sceneContext" />
      <section class="control-deck p-2" :class="{ 'control-deck--tension': fishingStore.tensionChallenge }">
        <div class="side-panel">
          <div class="flex justify-between items-center mx-[3px]">
            <button
              type="button"
              class="equipment-toggle"
              :aria-expanded="!equipmentCollapsed"
              aria-controls="equipment-menu"
              @click="toggleEquipment"
            >
              {{ equipmentCollapsed ? tr('MyTeamPanel.mo') : tr('FishingView.thu_gon') }}
            </button>
          </div>
          <div id="equipment-menu" :class="{ 'equipment-menu-collapsed': equipmentCollapsed }">
            <EquipmentMenu />
          </div>
        </div>
        <TensionChallenge v-if="fishingStore.tensionChallenge" />
        <section
          v-else
          :aria-label="tr('FishingView.trang_thai_cau_ca')"
          class="flex flex-col gap-3 rounded-[15px] border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-[#24352a]"
        >
          <div role="status" class="text-xs">{{ fishingStore.castMessage }}</div>
          <button
            type="button"
            class="rounded-[10px] border border-[#cbd9c6] bg-white px-3 py-2 text-xs font-bold enabled:hover:bg-[#e2ecdc] disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="!fishingStore.canReelIn"
            @click="fishingStore.reelInBait"
          >
            {{ tr('NewPlayerFishing.thu_moi') }}
          </button>
        </section>
      </section>
    </div>
    <CatchDialog />
    <FishingBag />
    <FishingPlayers />
    <LakeFishGuide />
    <Teleport to="body">
      <Transition name="exit-dialog">
        <div
          v-if="showExitConfirmation"
          class="fixed z-[40] inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.72)] backdrop-blur-[7px]"
          role="presentation"
          @click.self="showExitConfirmation = false"
        >
          <section
            class="w-[min(380px,100%)] p-5 border border-[rgba(255,226,149,0.5)] rounded-[20px] bg-[linear-gradient(145deg,#1b4531,#0f2e1f)] shadow-[0_24px_70px_rgba(0,0,0,0.6)] text-[#f4f0df] text-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-exit-title"
          >
            <div id="confirm-exit-title" class="m-0 text-lg font-bold text-[#e8bd62]">{{ tr('FishingView.ket_thuc_chuyen_cau_2') }}</div>
            <div class="my-4 text-sm text-[#c8dccb] leading-relaxed">
              {{ tr('FishingView.gio_ca_hien_co') }} <strong class="text-white">{{ fishingStore.inventory.length }}</strong> {{ tr('FishingView.con_ca_ban_co_chac_chan_muon_quay_lai_ban_do_khong') }}
            </div>
            <div v-if="fishingStore.leaveAreaError" role="alert" class="my-3 text-sm text-red-300">
              {{ fishingStore.leaveAreaError }}
            </div>
            <div class="flex justify-center gap-3 mt-5">
              <button
                type="button"
                class="px-4 py-2 border border-[rgba(255,255,255,0.2)] rounded-xl bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-white text-xs font-semibold transition-colors cursor-pointer"
                @click="showExitConfirmation = false"
              >
                {{ tr('FishingView.o_lai_cau') }}
              </button>
              <button
                type="button"
                class="px-4 py-2 border border-[#e65c5c] rounded-xl bg-[#c23b3b] hover:bg-[#d94848] text-white text-xs font-bold shadow-[0_4px_12px_rgba(194,59,59,0.4)] transition-colors cursor-pointer disabled:opacity-50"
                :disabled="fishingStore.isLeavingArea"
                @click="router.push({ name: 'home' })"
              >
                {{ fishingStore.isLeavingArea ? tr('FishingView.dang_quay_lai') : tr('FishingView.ket_thuc_chuyen_cau') }}
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="settingsOpen"
        class="fixed inset-0 z-[31] grid place-items-center bg-[rgba(4,17,11,0.72)] p-5 backdrop-blur-[7px]"
        @click.self="settingsOpen = false"
        @keydown.esc.stop="settingsOpen = false"
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="fishing-settings-title"
          class="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 text-[#24352a]"
        >
          <header class="mb-4 flex items-center justify-between gap-4 border-b pb-2">
            <dib id="fishing-settings-title" class="text-lg font-bold">{{ tr('FishingView.cai_dat_cau_ca') }}</dib>
            <button
              type="button"
              class="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#cbd9c6] text-2xl leading-none hover:bg-[#e2ecdc]"
              :aria-label="tr('FishingView.dong_cai_dat')"
              @click="settingsOpen = false"
            >
              ×
            </button>
          </header>
          <div class="flex items-center justify-between gap-4">
            <div>
              <div id="fishing-sound-label" class="font-bold text-xl">{{ tr('FishingView.am_thanh_nen') }}</div>
              <div class="mt-1 text-sm">{{ tr('FishingView.tieng_chim_ngau_nhien_voi_khoang_nghi_giua_cac_luot_phat') }}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-labelledby="fishing-sound-label"
              :aria-checked="userSettingStore.isFishingBackgroundSoundTurnOn"
              :disabled="!userSettingStore.ready || userSettingStore.saving"
              class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-[#cbd9c6] transition-colors disabled:opacity-50"
              :class="userSettingStore.isFishingBackgroundSoundTurnOn ? 'bg-[#426b3e]' : 'bg-[#cbd9c6]'"
              @click="userSettingStore.toggleFishingBackgroundSound"
            >
              <span
                class="h-5 w-5 rounded-full bg-white shadow transition-transform"
                :class="userSettingStore.isFishingBackgroundSoundTurnOn ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
          </div>
          <div v-if="userSettingStore.loading || userSettingStore.saving" role="status" class="mt-3 text-sm">
            {{ userSettingStore.loading ? tr('FishingView.dang_tai_cai_dat') : tr('FishingView.dang_luu_cai_dat') }}
          </div>
          <div v-if="userSettingStore.error" role="alert" class="mt-3 text-sm text-red-700">
            <div>{{ userSettingStore.error }}</div>
            <button
              v-if="!userSettingStore.ready"
              type="button"
              class="mt-2 underline"
              @click="userSettingStore.load(user?.id ?? null)"
            >
              {{ tr('Maintenance.thu_lai') }}
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </main>
  <div
    v-if="!sessionReady && fishingStore.leaveAreaError"
    role="alert"
    class="fixed bottom-4 left-4 right-4 z-50 rounded-lg bg-[#f5f9f0] p-3 text-center text-red-700"
  >
    {{ fishingStore.leaveAreaError }}
  </div>
</template>

<style scoped>
.exit-dialog-enter-active,
.exit-dialog-leave-active {
  transition: opacity 0.18s ease;
}

.exit-dialog-enter-from,
.exit-dialog-leave-to {
  opacity: 0;
}

.control-deck {
  z-index: 5;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 272px;
  gap: 8px;
  background: linear-gradient(180deg, #1b3929, #11251a);
  box-shadow: 0 -8px 24px rgba(3, 13, 7, 0.25);
}

.control-deck--tension {
  grid-template-columns: minmax(0, 1fr) clamp(360px, 38vw, 480px);
  align-items: start;
}

.side-panel {
  min-width: 0;
  padding: 6px 13px;
  border: 1px solid rgba(225, 246, 214, 0.23);
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(16, 42, 27, 0.89), rgba(27, 61, 41, 0.82));
}

.equipment-toggle {
  display: none;
}

.control-deck :deep(.tool) {
  border-color: rgba(237, 248, 221, 0.14);
  background: rgba(11, 35, 22, 0.72);
  color: #edf4e8;
}

.control-deck :deep(.tool:hover) {
  border-color: #b6d67f;
}

.control-deck :deep(.tool.selected) {
  border-color: #a6cc78;
  background: rgba(62, 109, 55, 0.87);
  box-shadow: inset 0 0 0 1px rgba(211, 239, 164, 0.24);
}

.control-deck :deep(.tool-icon) {
  background: rgba(238, 210, 136, 0.2);
}

.control-deck :deep(.selected .tool-icon) {
  background: rgba(194, 225, 142, 0.3);
}

.control-deck :deep(.tool small) {
  color: #aebfaa;
}

@media (max-width: 720px) {
  .control-deck,
  .control-deck--tension {
    grid-template-columns: 1fr;
    gap: 4px;
    padding: 5px 12px 6px;
  }

  .side-panel {
    padding: 4px 9px;
  }

  .equipment-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid rgba(225, 246, 214, 0.24);
    border-radius: 9px;
    background: rgba(11, 35, 22, 0.58);
    color: #e9f4e8;
    font-size: 11px;
    font-weight: 700;
  }

  .equipment-menu-collapsed {
    display: none;
  }
}
</style>
