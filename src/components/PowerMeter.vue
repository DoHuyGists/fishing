<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { useFishingStore } from "../stores/fishing";

const store = useFishingStore();
const frameId = ref<number>();
let previousFrame = 0;

function tick(timestamp: number) {
  store.updateFight(Math.min(timestamp - previousFrame, 50));
  previousFrame = timestamp;
  if (store.canPull) {
    frameId.value = requestAnimationFrame(tick);
  } else {
    frameId.value = undefined;
  }
}

function beginPull() {
  if (!store.canPull) return;
  store.startPull();
  previousFrame = performance.now();
  if (!frameId.value) frameId.value = requestAnimationFrame(tick);
}

function releasePull() {
  store.stopPull();
}

onBeforeUnmount(() => {
  if (frameId.value) cancelAnimationFrame(frameId.value);
});
</script>

<template>
  <section class="power-meter" :class="`tension-${store.tensionState}`">
    <div class="power-title">
      <span class="bolt">↯</span>
      <div>
        <strong>Lực kéo</strong><small>{{ store.canPull ? "Giữ để tăng, buông để giảm" : "Chờ cá cắn câu" }}</small>
      </div>
      <b>{{ Math.round(store.tension) }}%</b>
    </div>
    <div class="power-track">
      <span class="safe-zone"></span>
      <div class="power-fill" :style="{ width: `${store.tension}%` }"><i></i></div>
    </div>
    <div class="progress-label">
      <span>Tiến độ kéo cá</span><b>{{ Math.round(store.catchProgress) }}%</b>
    </div>
    <div class="catch-track"><i :style="{ width: `${store.catchProgress}%` }"></i></div>
    <button
      type="button"
      class="cast-button"
      :disabled="!store.canPull"
      @pointerdown.prevent="beginPull"
      @pointerup="releasePull"
      @pointerleave="releasePull"
      @pointercancel="releasePull"
    >
      <span>⌁</span>{{ store.isPulling ? "Đang kéo cần..." : "Nhấn giữ để kéo" }}
    </button>
  </section>
</template>

<style scoped>
.power-meter {
  padding: 12px 14px;
  border: 1px solid #e3e0d8;
  border-radius: 15px;
  background: #fffefa;
}
.power-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #385645;
}
.bolt {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 8px;
  background: #f8e6b8;
  color: #be7b1d;
  font-size: 22px;
  font-weight: 900;
}
.power-title div {
  flex: 1;
}
.power-title strong,
.power-title small {
  display: block;
}
.power-title strong {
  font-size: 11px;
}
.power-title small {
  margin-top: 2px;
  color: #879188;
  font-size: 9px;
}
.power-title b,
.progress-label b {
  color: #e29a31;
  font-size: 13px;
}
.power-track,
.catch-track {
  position: relative;
  height: 8px;
  margin: 10px 0;
  overflow: hidden;
  border-radius: 99px;
  background: #e6e9df;
}
.safe-zone {
  position: absolute;
  z-index: 1;
  top: 0;
  bottom: 0;
  left: 28%;
  width: 54%;
  background: rgba(118, 175, 83, 0.26);
}
.power-fill {
  position: relative;
  z-index: 2;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #8dbb64, #f1bd4e 70%, #e66f44);
  transition: width 0.06s linear;
}
.power-fill i {
  position: absolute;
  right: 0;
  top: -2px;
  width: 4px;
  height: 12px;
  border-radius: 3px;
  background: white;
}
.tension-danger .power-title b {
  color: #e8593f;
}
.progress-label {
  display: flex;
  justify-content: space-between;
  color: #617363;
  font-size: 9px;
  font-weight: 700;
}
.catch-track {
  height: 5px;
  margin: 5px 0 10px;
}
.catch-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #75b865;
  transition: width 0.1s linear;
}
.cast-button {
  width: 100%;
  padding: 10px;
  border: 0;
  border-radius: 10px;
  background: #3f7652;
  box-shadow: 0 4px 0 #2d593c;
  color: white;
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.01em;
  touch-action: none;
}
.cast-button:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: 0 1px 0 #2d593c;
}
.cast-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.cast-button span {
  margin-right: 7px;
  color: #ffe18a;
  font-size: 16px;
}
</style>
