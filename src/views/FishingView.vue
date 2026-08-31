<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onBeforeUnmount, onMounted, watch } from "vue";
import EquipmentMenu from "../components/EquipmentMenu.vue";
import CatchDialog from "../components/CatchDialog.vue";
import FishingBag from "../components/FishingBag.vue";
import FishingPlayers from "../components/FishingPlayers.vue";
import FishingScene from "../components/FishingScene.vue";
import LakeFishGuide from "../components/LakeFishGuide.vue";
import PowerMeter from "../components/PowerMeter.vue";
import { useAuthStore } from "../stores/auth";
import { useEquipmentStore } from "../stores/equipment";

const authStore = useAuthStore();
const equipmentStore = useEquipmentStore();
const { user } = storeToRefs(authStore);

watch(
  user,
  (current) => {
    if (current) equipmentStore.fetchEquipment(current.id);
  },
  { immediate: true },
);

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
  window.removeEventListener("keydown", preventZoomShortcut);
  window.removeEventListener("wheel", preventZoomWheel);
  document.removeEventListener("gesturestart", preventGesture);
  document.removeEventListener("gesturechange", preventGesture);
  document.removeEventListener("gestureend", preventGesture);
});
</script>

<template>
  <main
    class="w-full h-screen overflow-hidden touch-none overscroll-none bg-[#193224] text-[#e9f4e8] font-[Inter,ui-sans-serif,system-ui,sans-serif]"
  >
    <div class="grid grid-rows-[minmax(0,1fr)_auto] w-full h-full">
      <FishingScene />
      <section class="control-deck">
        <div class="side-panel">
          <div class="flex justify-between items-baseline mx-[3px] mb-2">
            <span class="text-[#f1e6b7] text-[11px] font-black tracking-[0.08em] uppercase">Trang bị</span>
            <!-- <small class="text-[#b8cab5] text-[9px]">Chạm để đổi dụng cụ</small> -->
          </div>
          <EquipmentMenu />
        </div>
        <PowerMeter />
      </section>
    </div>
    <CatchDialog />
    <FishingBag />
    <FishingPlayers />
    <LakeFishGuide />
  </main>
</template>

<style scoped>
.control-deck {
  z-index: 5;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 272px;
  gap: 13px;
  padding: 14px clamp(14px, 4vw, 58px) clamp(14px, 3vh, 28px);
  background: linear-gradient(180deg, #1b3929, #11251a);
  box-shadow: 0 -8px 24px rgba(3, 13, 7, 0.25);
}
.side-panel {
  padding: 11px 13px 13px;
  border: 1px solid rgba(225, 246, 214, 0.23);
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(16, 42, 27, 0.89), rgba(27, 61, 41, 0.82));
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
.control-deck :deep(.power-meter) {
  border-color: rgba(225, 246, 214, 0.23);
  background: linear-gradient(135deg, rgba(16, 42, 27, 0.92), rgba(27, 61, 41, 0.84));
}
.control-deck :deep(.power-title) {
  color: #eaf4e8;
}
.control-deck :deep(.power-title small) {
  color: #b8cab5;
}
.control-deck :deep(.power-track) {
  background: #daefc92e;
}
.control-deck :deep(.cast-button) {
  background: #d49c42;
  box-shadow: 0 4px 0 #9e6929;
  color: #1e3528;
}
.control-deck :deep(.cast-button:active) {
  box-shadow: 0 1px 0 #9e6929;
}
@media (max-width: 720px) {
  .control-deck {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 9px 12px 12px;
  }
  .side-panel {
    padding: 9px;
  }
  .panel-heading {
    display: none;
  }
}
</style>
