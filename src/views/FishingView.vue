<script setup lang="ts">
import type { FishingSceneContext } from "../types/model/fishingGameplay";
import { t as tr } from "../i18n";

import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import EquipmentMenu from "../components/player/player-fishing/EquipmentMenu.vue";
import CatchDialog from "../components/player/player-fishing/CatchDialog.vue";
import FishingBag from "../components/player/player-fishing/FishingBag.vue";
import FishingPlayers from "../components/player/player-fishing/FishingPlayers.vue";
import FishingScene from "../components/player/player-fishing/FishingScene.vue";
import LakeFishGuide from "../components/player/player-fishing/LakeFishGuide.vue";
import { useFishingTransitionStore } from "../stores/player-fishing-transition-store";
import TensionChallenge from "../components/player/player-fishing-challenge/TensionChallenge.vue";
import { useFishingStore } from "../stores/player-fishing-store.ts";
import { useAuthStore } from "../stores/auth";
import { useEquipmentStore } from "../stores/player-equipment-store.ts";
import { useUserSettingStore } from "../stores/player-user-setting-store.ts";
import { useFishingBackgroundSoundStore } from "../stores/player-fishing-background-sound-store.ts";
import DayPhaseClock from "../components/player/player-fishing/DayPhaseClock.vue";
import FishingFatigue from "../components/player/player-fishing/FishingFatigue.vue";
import FishingSurvival from '../components/player/player-fishing/FishingSurvival.vue';
import SurvivalDeathDialog from '../components/player/player-fishing/SurvivalDeathDialog.vue';
import { useDayPhaseClock } from "../composables/useDayPhaseClock";
import { useAreaWeather } from "../composables/useAreaWeather";
import { useFishingSceneStore } from "../stores/player-fishing-scene-store";
import { useUserInAreaStore } from "../stores/player-user-In-area-store.ts";
import { supabaseFishingAreaRepository } from "../data/supabaseFishingAreaRepository";
import type { RealtimeChannel } from "@supabase/supabase-js";

const authStore = useAuthStore();
const router = useRouter();
const fishingStore = useFishingStore();
const fishingTransition = useFishingTransitionStore();
const equipmentStore = useEquipmentStore();
const userSettingStore = useUserSettingStore();
const backgroundSoundStore = useFishingBackgroundSoundStore();
const dayPhaseStore = useDayPhaseClock();
const userInAreaStore = useUserInAreaStore();
const fishingSceneStore = useFishingSceneStore();
useAreaWeather(() => userInAreaStore.userInArea?.area_id);
const selectedBait = computed(() =>
  equipmentStore.variants.bait?.find((bait) => bait.id === fishingStore.equipmentLoadout.bait),
);
const { user } = storeToRefs(authStore);
const { sessionReady, sessionError } = storeToRefs(fishingStore);
const equipmentCollapsed = ref(true);
const settingsOpen = ref(false);
const showExitConfirmation = ref(false);
const sceneContext = computed<FishingSceneContext>(() => ({
  state: fishingStore,
  sceneImage: fishingSceneStore.sceneImage,
  fallbackSceneImage: fishingSceneStore.fallbackSceneImage,
  sceneKey: fishingSceneStore.sceneKey,
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
  () => [sessionReady.value, sessionError.value, sceneContext.value.sceneImage, sceneContext.value.rodImage] as const,
  ([ready, error, sceneImage, rodImage]) => {
    if (error) fishingTransition.hide();
    else if (!ready) fishingTransition.show();
    else if (fishingTransition.visible) void fishingTransition.revealScene([sceneImage, rodImage]);
  },
  { immediate: true, flush: "post" },
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
  fishingTransition.hide();
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
  <section
    v-if="!sessionReady && sessionError"
    class="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center text-content"
    role="alert"
  >
    <div>{{ tr("FishingView.khong_the_chuan_bi_phien_cau") }} {{ sessionError }}</div>
    <button
      type="button"
      class="rounded-xl border border-[var(--color-ocean-gold)] bg-[var(--color-ocean-gold)] px-4 py-2 font-bold text-content transition hover:brightness-110"
      @click="retrySetup"
    >
      {{ tr("Maintenance.thu_lai") }}
    </button>
    <button
      type="button"
      class="rounded-xl border border-border-default bg-surface px-4 py-2 font-medium transition hover:border-[var(--color-ocean-cyan)] disabled:opacity-50"
      :disabled="fishingStore.isLeavingArea"
      @click="router.push({ name: 'home' })"
    >
      {{ tr("FishingView.quay_lai_ban_do") }}
    </button>
  </section>
  <main v-else-if="sessionReady" class="w-full h-screen overflow-hidden touch-none overscroll-none bg-[var(--color-ocean-deep)] text-[var(--color-ocean-pearl)]">
    <SurvivalDeathDialog />
    <div class="fixed top-3 left-3 z-20 text-white flex justify-between items-start">
      <div class="flex flex-col gap-2">
        <DayPhaseClock />
        <FishingSurvival v-if="fishingStore.currentArea.survivalMode" class="w-[min(21rem,calc(100vw-1.5rem))]" />
        <FishingFatigue
          v-else
          variant="compact"
          class="max-w-60"
          :area-id="userInAreaStore.userInArea?.area_id ?? null"
          presence
        />
        <div class="h-fit w-fit">
          <button
            type="button"
            class="rounded-xl border border-danger bg-danger px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-content hover:border-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            :disabled="fishingStore.isLeavingArea"
            @click="showExitConfirmation = true"
          >
            {{ fishingStore.isLeavingArea ? tr("FishingView.dang_quay_lai") : tr("FishingView.ket_thuc_chuyen_cau") }}
          </button>
        </div>
      </div>
    </div>
    <button
      type="button"
      class="fixed right-3 top-3 z-20 rounded-xl border border-[var(--color-ocean-gold)]/60 bg-[var(--color-ocean-deep)]/90 px-3 py-2 text-xs font-bold text-[var(--color-ocean-pearl)] backdrop-blur-md transition hover:border-[var(--color-ocean-cyan)] hover:bg-[var(--color-ocean-panel)]"
      aria-haspopup="dialog"
      @click="settingsOpen = true"
    >
      {{ tr("FishingView.cai_dat") }}
    </button>
    <div class="grid grid-rows-[minmax(0,1fr)_auto] w-full h-dvh">
      <FishingScene :context="sceneContext" />
      <section class="control-deck p-2" :class="{ 'control-deck--tension': fishingStore.tensionChallenge }">
        <div class="side-panel">
          <div class="flex justify-between md:justify-end items-center">
            <button
              type="button"
              class="equipment-toggle"
              :aria-expanded="!equipmentCollapsed"
              aria-controls="equipment-menu"
              @click="toggleEquipment"
            >
              {{ equipmentCollapsed ? tr("MyTeamPanel.mo") : tr("FishingView.thu_gon") }}
            </button>
            <div
              class="slide-fade-in from-top player-content-in flex shrink-0 items-center gap-2 rounded-lg border border-border-default bg-surface px-2 py-1 text-[11px] leading-3 text-content"
              :aria-label="tr('EquipmentMenu.moi_dang_chon')"
            >
              <img :src="selectedBait?.image ?? ''" class="size-6 object-contain" alt="" />
              <div class="flex flex-col gap-0.5">
                <span class="font-bold">{{ selectedBait?.name ?? tr("EquipmentMenu.chua_chon_moi") }}</span>
                <span class="text-[var(--color-ocean-pearl)]/70">{{ tr("EquipmentMenu.con") }} {{ selectedBait?.quantity ?? 0 }}</span>
              </div>
            </div>
          </div>
          <div id="equipment-menu" class="mt-1" :class="{ 'equipment-menu-collapsed': equipmentCollapsed }">
            <EquipmentMenu />
          </div>
        </div>
        <TensionChallenge v-if="fishingStore.tensionChallenge && fishingStore.castPhase !== 'unconfirmed'" />
        <section
          v-else
          :aria-label="tr('FishingView.trang_thai_cau_ca')"
          class="flex flex-col gap-3 rounded-[15px] border border-border-default bg-surface p-3 text-content"
        >
          <div role="status" class="text-xs">{{ fishingStore.castMessage }}</div>
          <button
            v-if="fishingStore.pendingResult"
            type="button"
            class="rounded-[10px] border border-[var(--color-ocean-gold)] bg-[var(--color-ocean-gold)] px-3 py-2 text-xs font-bold text-content transition enabled:hover:brightness-110 disabled:opacity-45"
            :disabled="fishingStore.castPhase !== 'unconfirmed'"
            @click="fishingStore.retryPendingResult"
          >
            {{ tr("fishing.retry_result") }}
          </button>
          <div v-if="fishingStore.isFishingNetFull" role="status" class="text-xs font-bold text-[var(--color-ocean-gold)]">
            {{ tr("FishingBag.capacity_reached", { capacity: fishingStore.fishingNetCapacity }) }}
          </div>
          <button
            type="button"
            class="rounded-[10px] border border-[var(--color-ocean-gold)] bg-[var(--color-ocean-gold)] px-3 py-2 text-xs font-bold text-content transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            v-if="!fishingStore.pendingResult"
            :disabled="!fishingStore.canReelIn"
            @click="fishingStore.reelInBait"
          >
            {{ tr("NewPlayerFishing.thu_moi") }}
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
          class="fixed z-[40] inset-0 grid place-items-center p-5 bg-[color-mix(in_srgb,_var(--color-content)_78%,_transparent)] backdrop-blur-[7px]"
          role="presentation"
          @click.self="showExitConfirmation = false"
        >
          <section
            class="w-[min(380px,100%)] p-5 border border-[var(--color-ocean-gold)]/60 rounded-[20px] bg-primary shadow-[0_24px_70px_color-mix(in_srgb,_var(--color-content)_60%,_transparent)] text-[var(--color-ocean-pearl)] text-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-exit-title"
          >
            <div id="confirm-exit-title" class="m-0 text-lg font-bold text-[var(--color-ocean-gold)]">
              {{ tr("FishingView.ket_thuc_chuyen_cau_2") }}
            </div>
            <div class="my-4 text-sm text-[var(--color-ocean-pearl)]/80 leading-relaxed">
              {{ tr("FishingView.gio_ca_hien_co") }}
              <strong class="text-[var(--color-ocean-gold)]">{{ fishingStore.inventory.length }}</strong>
              {{ tr("FishingView.con_ca_ban_co_chac_chan_muon_quay_lai_ban_do_khong") }}
            </div>
            <div v-if="fishingStore.leaveAreaError" role="alert" class="my-3 text-sm text-danger">
              {{ fishingStore.leaveAreaError }}
            </div>
            <div class="flex justify-center gap-3 mt-5">
              <button
                type="button"
                class="px-4 py-2 border border-[var(--color-ocean-cyan)]/40 rounded-xl bg-[var(--color-ocean-deep)] hover:bg-[var(--color-ocean-panel)] text-[var(--color-ocean-pearl)] text-xs font-semibold transition-colors cursor-pointer"
                @click="showExitConfirmation = false"
              >
                {{ tr("FishingView.o_lai_cau") }}
              </button>
              <button
                type="button"
                class="px-4 py-2 border border-[var(--color-ocean-gold)] rounded-xl bg-[var(--color-ocean-gold)] hover:brightness-110 text-content text-xs font-bold shadow-[0_4px_12px_color-mix(in_srgb,_var(--color-gold)_20%,_transparent)] transition cursor-pointer disabled:opacity-50"
                :disabled="fishingStore.isLeavingArea"
                @click="router.push({ name: 'lobby' })"
              >
                {{
                  fishingStore.isLeavingArea ? tr("FishingView.dang_quay_lai") : tr("FishingView.ket_thuc_chuyen_cau")
                }}
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="settingsOpen"
        class="fixed inset-0 z-[31] grid place-items-center bg-[color-mix(in_srgb,_var(--color-content)_78%,_transparent)] p-5 backdrop-blur-[7px]"
        @click.self="settingsOpen = false"
        @keydown.esc.stop="settingsOpen = false"
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="fishing-settings-title"
          class="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--color-ocean-gold)]/60 bg-surface p-5 text-content shadow-[0_24px_70px_color-mix(in_srgb,_var(--color-content)_50%,_transparent)]"
        >
          <header class="mb-4 flex items-center justify-between gap-4 border-b border-[var(--color-ocean-gold)]/25 pb-3">
            <div id="fishing-settings-title" class="text-lg font-bold text-[var(--color-ocean-gold)]">{{ tr("FishingView.cai_dat_cau_ca") }}</div>
            <button
              type="button"
              class="flex size-8 shrink-0 items-center justify-center rounded-full border border-border-default text-2xl leading-none transition hover:border-[var(--color-ocean-cyan)] hover:bg-[var(--color-ocean-deep)]"
              :aria-label="tr('FishingView.dong_cai_dat')"
              @click="settingsOpen = false"
            >
              ×
            </button>
          </header>
          <div class="flex items-center justify-between gap-4">
            <div>
              <div id="fishing-sound-label" class="font-bold text-xl">{{ tr("FishingView.am_thanh_nen") }}</div>
              <div class="mt-1 text-sm">
                {{ tr("FishingView.tieng_chim_ngau_nhien_voi_khoang_nghi_giua_cac_luot_phat") }}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-labelledby="fishing-sound-label"
              :aria-checked="userSettingStore.isFishingBackgroundSoundTurnOn"
              :disabled="!userSettingStore.ready || userSettingStore.saving"
              class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border-default transition-colors disabled:opacity-50"
              :class="userSettingStore.isFishingBackgroundSoundTurnOn ? 'bg-[var(--color-ocean-cyan)]' : 'bg-[var(--color-ocean-deep)]'"
              @click="userSettingStore.toggleFishingBackgroundSound"
            >
              <span
                class="h-5 w-5 rounded-full bg-[var(--color-ocean-pearl)] shadow-sm transition-transform"
                :class="userSettingStore.isFishingBackgroundSoundTurnOn ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
          </div>
          <div v-if="userSettingStore.loading || userSettingStore.saving" role="status" class="mt-3 text-sm">
            {{ userSettingStore.loading ? tr("FishingView.dang_tai_cai_dat") : tr("FishingView.dang_luu_cai_dat") }}
          </div>
          <div v-if="userSettingStore.error" role="alert" class="mt-3 text-sm text-danger">
            <div>{{ userSettingStore.error }}</div>
            <button
              v-if="!userSettingStore.ready"
              type="button"
              class="mt-2 underline"
              @click="userSettingStore.load(user?.id ?? null)"
            >
              {{ tr("Maintenance.thu_lai") }}
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </main>
  <div
    v-if="!sessionReady && fishingStore.leaveAreaError"
    role="alert"
    class="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-danger/40 bg-surface p-3 text-center text-danger"
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
  border-top: 1px solid color-mix(in srgb, var(--color-gold) 40%, transparent);
  background: var(--color-primary);
  box-shadow: 0 -8px 24px color-mix(in srgb, var(--color-content) 30%, transparent);
}

.control-deck--tension {
  grid-template-columns: minmax(0, 1fr) clamp(360px, 38vw, 480px);
  align-items: start;
}

.side-panel {
  min-width: 0;
  padding: 6px 13px;
  border: 1px solid color-mix(in srgb, var(--color-sky) 30%, transparent);
  border-radius: 16px;
}

.equipment-toggle {
  display: none;
}

.control-deck :deep(.tool) {
  border-color: color-mix(in srgb, var(--color-sky) 25%, transparent);
  background: color-mix(in srgb, var(--color-content) 85%, transparent);
  color: var(--color-ocean-pearl);
}

.control-deck :deep(.tool:hover) {
  border-color: var(--color-ocean-cyan);
}

.control-deck :deep(.tool.selected) {
  border-color: var(--color-ocean-gold);
  background: color-mix(in srgb, var(--color-primary) 95%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-gold) 20%, transparent), 0 0 14px color-mix(in srgb, var(--color-sky) 12%, transparent);
}

.control-deck :deep(.tool-icon) {
  background: color-mix(in srgb, var(--color-gold) 15%, transparent);
}

.control-deck :deep(.selected .tool-icon) {
  background: color-mix(in srgb, var(--color-gold) 28%, transparent);
}

.control-deck :deep(.tool small) {
  color: color-mix(in srgb, var(--color-surface) 70%, transparent);
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
    border: 1px solid color-mix(in srgb, var(--color-gold) 45%, transparent);
    border-radius: 9px;
    background: color-mix(in srgb, var(--color-content) 85%, transparent);
    color: var(--color-ocean-pearl);
    font-size: 11px;
    font-weight: 700;
  }

  .equipment-menu-collapsed {
    display: none;
  }
}
</style>
