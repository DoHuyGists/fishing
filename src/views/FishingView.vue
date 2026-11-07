<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
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
import Modal from "../components/shared/Modal.vue";
import { useModalStore } from "../stores/modal";
import { useUserSettingStore } from "../stores/userSetting";
import { useFishingBackgroundSoundStore } from "../stores/fishingBackgroundSound";

const authStore = useAuthStore();
const router = useRouter();
const fishingStore = useFishingStore();
const equipmentStore = useEquipmentStore();
const modalStore = useModalStore();
const userSettingStore = useUserSettingStore();
const backgroundSoundStore = useFishingBackgroundSoundStore();
const { user } = storeToRefs(authStore);
const { sessionReady, sessionError } = storeToRefs(fishingStore);
const equipmentCollapsed = ref(true);

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
  backgroundSoundStore.stop();
  if (modalStore.isOpening("fishing-settings")) modalStore.close();
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
  <Loading v-if="!sessionReady && !sessionError" text="Đang chuẩn bị dữ liệu câu cá" />
  <section
    v-else-if="!sessionReady"
    class="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f9f0] px-6 text-center text-[#24352a]"
    role="alert"
  >
    <p>Không thể chuẩn bị phiên câu: {{ sessionError }}</p>
    <button
      type="button"
      class="rounded-lg border border-[#cbd9c6] bg-white px-4 py-2 font-medium hover:bg-[#f5f9f0]"
      @click="retrySetup"
    >
      Thử lại
    </button>
    <button
      type="button"
      class="rounded-lg border border-[#cbd9c6] bg-white px-4 py-2 font-medium hover:bg-[#f5f9f0] disabled:opacity-50"
      :disabled="fishingStore.isLeavingArea"
      @click="router.push({ name: 'home' })"
    >
      Quay lại bản đồ
    </button>
  </section>
  <main v-else class="w-full h-screen overflow-hidden touch-none overscroll-none bg-[#193224] text-[#e9f4e8]">
    <div class="grid grid-rows-[minmax(0,1fr)_auto] w-full h-dvh">
      <FishingScene />
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
              {{ equipmentCollapsed ? "Mở" : "Thu gọn" }}
            </button>
            <button
              type="button"
              class="ml-auto rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-1.5 text-xs font-bold text-[#24352a] hover:bg-[#e2ecdc]"
              aria-haspopup="dialog"
              @click="modalStore.open('fishing-settings')"
            >
              Cài đặt
            </button>
          </div>
          <div id="equipment-menu" :class="{ 'equipment-menu-collapsed': equipmentCollapsed }">
            <EquipmentMenu />
          </div>
        </div>
        <TensionChallenge v-if="fishingStore.tensionChallenge" />
        <section v-else aria-label="Trạng thái câu cá" class="flex flex-col gap-3 rounded-[15px] border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-[#24352a]">
          <p role="status" class="text-xs">{{ fishingStore.castMessage }}</p>
          <button
            type="button"
            class="rounded-[10px] border border-[#cbd9c6] bg-white px-3 py-2 text-xs font-bold enabled:hover:bg-[#e2ecdc] disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="!fishingStore.canReelIn"
            @click="fishingStore.reelInBait"
          >
            Thu mồi
          </button>
        </section>
      </section>
    </div>
    <CatchDialog />
    <FishingBag />
    <FishingPlayers />
    <LakeFishGuide />
    <Teleport to="body">
      <Modal v-if="modalStore.isOpening('fishing-settings')" title="Cài đặt câu cá" :show-count-data="false">
        <section class="mx-auto max-w-lg rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 text-[#24352a]">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h3 id="fishing-sound-label" class="font-bold">Âm thanh nền</h3>
              <p class="mt-1 text-sm">Tiếng chim ngẫu nhiên với khoảng nghỉ giữa các lượt phát.</p>
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
              <span class="h-5 w-5 rounded-full bg-white shadow transition-transform" :class="userSettingStore.isFishingBackgroundSoundTurnOn ? 'translate-x-6' : 'translate-x-1'" />
            </button>
          </div>
          <p v-if="userSettingStore.loading || userSettingStore.saving" role="status" class="mt-3 text-sm">
            {{ userSettingStore.loading ? "Đang tải cài đặt..." : "Đang lưu cài đặt..." }}
          </p>
          <div v-if="userSettingStore.error" role="alert" class="mt-3 text-sm text-red-700">
            <p>{{ userSettingStore.error }}</p>
            <button v-if="!userSettingStore.ready" type="button" class="mt-2 underline" @click="userSettingStore.load(user?.id ?? null)">
              Thử lại
            </button>
          </div>
        </section>
      </Modal>
    </Teleport>
  </main>
  <p v-if="!sessionReady && fishingStore.leaveAreaError" role="alert" class="fixed bottom-4 left-4 right-4 z-50 rounded-lg bg-[#f5f9f0] p-3 text-center text-red-700">
    {{ fishingStore.leaveAreaError }}
  </p>
</template>

<style scoped>
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
