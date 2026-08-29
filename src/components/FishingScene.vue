<script setup lang="ts">
import { computed, ref } from "vue";
import { isPointInWater } from "../data/fishingMap";
import { useFishingStore } from "../stores/fishing";

const store = useFishingStore();
const ripple = ref(false);
const invalidTap = ref(false);
const castClass = computed(() => `phase-${store.castPhase}`);
const linePath = computed(() => {
  const { x, y } = store.baitPosition;
  return `M 82 17 Q 75 45 ${x} ${y}`;
});

function castAt(event: MouseEvent) {
  const scene = event.currentTarget as HTMLElement;
  const bounds = scene.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
  if (!isPointInWater({ x, y })) {
    invalidTap.value = true;
    store.rejectCast();
    window.setTimeout(() => (invalidTap.value = false), 520);
    return;
  }
  store.castTo(x, y);
  ripple.value = true;
  window.setTimeout(() => (ripple.value = false), 1200);
}
</script>

<template>
  <section class="fishing-scene" @click="castAt">
    <img src="/pond.jpg" alt="Ao câu trong rừng" class="pond-image" />
    <div class="scene-shade"></div>
    <div class="scene-top">
      <div class="location">
        <span class="location-icon">⌖</span>
        <div><strong>Hồ Rừng Sương</strong><small>Điểm câu yêu thích</small></div>
      </div>
      <div class="scene-actions">
        <button type="button" class="guide-button" @click.stop="store.openLakeGuide">Cá trong hồ</button>
        <button type="button" class="players-button" @click.stop="store.openPlayers">
          Người câu <b>{{ store.nearbyPlayers.length }}</b>
        </button>
        <button type="button" class="bag-button" @click.stop="store.openBag">
          Túi cá <b>{{ store.inventory.length }}</b>
        </button>
        <div class="weather"><span>☀</span> 26°C <i></i> Gió nhẹ</div>
      </div>
    </div>

    <!-- <div class="scene-instruction">Chạm mặt hồ để vung cần đến điểm đó</div> -->
    <div class="water-glow"></div>
    <div v-if="invalidTap" class="invalid-tap">Chọn phần mặt nước</div>
    <div
      v-if="ripple"
      class="ripple"
      :style="{ left: `${store.baitPosition.x}%`, top: `${store.baitPosition.y}%` }"
    ></div>
    <svg class="casting-line" :class="castClass" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path :d="linePath" />
    </svg>
    <div
      class="bait-float"
      :class="castClass"
      :style="{ left: `${store.baitPosition.x}%`, top: `${store.baitPosition.y}%` }"
    >
      <span></span>
    </div>
    <div class="rod-holder" :class="castClass" aria-hidden="true">
      <img src="/fishing-rob.jpg" alt="" class="fishing-rod" />
    </div>
    <div class="bite-alert" :class="{ visible: store.castPhase === 'bite' }">! CÁ CẮN CÂU !</div>
    <div
      class="scene-status"
      :class="{ active: store.isCasting || store.castPhase === 'bite' || store.castPhase === 'fighting' }"
    >
      <span class="status-dot"></span>{{ store.castMessage }}
    </div>
  </section>
</template>

<style scoped>
.fishing-scene {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: #294430;
  cursor: crosshair;
}
.pond-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 62%;
}
.scene-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(9, 27, 20, 0.42), transparent 28%, transparent 66%, rgba(7, 29, 24, 0.24));
  pointer-events: none;
}
.scene-top {
  position: absolute;
  z-index: 2;
  top: 20px;
  left: 21px;
  right: 21px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
}
.location,
.weather,
.scene-status {
  backdrop-filter: blur(10px);
  background: rgba(17, 38, 27, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 6px 18px rgba(9, 20, 14, 0.16);
}
.location {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 15px 9px 10px;
  border-radius: 13px;
}
.location-icon {
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  border-radius: 9px;
  background: #eebd55;
  color: #244635;
  font-size: 21px;
}
.location strong,
.location small {
  display: block;
  line-height: 1.15;
}
.location strong {
  font-size: 14px;
}
.location small {
  margin-top: 3px;
  color: #d9e6dc;
  font-size: 10px;
}
.scene-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.weather {
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 10px 13px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 650;
}
.weather span {
  color: #ffcf67;
  font-size: 16px;
}
.weather i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #d6dfd8;
}
.bag-button {
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(17, 38, 27, 0.72);
  box-shadow: 0 6px 18px rgba(9, 20, 14, 0.16);
  color: white;
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  backdrop-filter: blur(10px);
}
.players-button { padding: 10px 12px; border: 1px solid rgba(255, 255, 255, .2); border-radius: 12px; background: rgba(17, 38, 27, .72); box-shadow: 0 6px 18px rgba(9, 20, 14, .16); color: white; cursor: pointer; font-size: 11px; font-weight: 800; backdrop-filter: blur(10px); }
.players-button b { display: inline-grid; place-items: center; min-width: 17px; height: 17px; margin-left: 4px; border-radius: 50%; background: #78c6b1; color: #173c31; font-size: 10px; }
.bag-button b {
  display: inline-grid;
  place-items: center;
  min-width: 17px;
  height: 17px;
  margin-left: 4px;
  border-radius: 50%;
  background: #eebd55;
  color: #244635;
  font-size: 10px;
}
.scene-instruction {
  position: absolute;
  z-index: 2;
  top: 47%;
  left: 50%;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.83);
  color: #395746;
  font-size: 11px;
  font-weight: 700;
  transform: translate(-50%, -50%);
  opacity: 0.78;
  white-space: nowrap;
}
.water-glow {
  position: absolute;
  width: 58%;
  height: 30%;
  left: 22%;
  top: 50%;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(225, 242, 187, 0.28), transparent 68%);
  pointer-events: none;
}
.invalid-tap {
  position: absolute;
  z-index: 5;
  top: 50%;
  left: 50%;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(91, 39, 24, 0.86);
  color: #fff2da;
  font-size: 11px;
  font-weight: 700;
  transform: translate(-50%, -50%);
  animation: invalid-tap 0.52s ease-out forwards;
  pointer-events: none;
}
.casting-line {
  position: absolute;
  z-index: 3;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.casting-line path {
  fill: none;
  stroke: rgba(241, 242, 223, 0.9);
  stroke-width: 0.18;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
}
.casting-line.phase-idle path,
.casting-line.phase-lost path,
.casting-line.phase-caught path {
  opacity: 0;
}
.casting-line.phase-casting path {
  stroke-dasharray: 130;
  stroke-dashoffset: 130;
  animation: cast-line 0.38s 0.17s ease-out forwards;
}
.bait-float {
  position: absolute;
  z-index: 4;
  width: 13px;
  height: 13px;
  border: 2px solid #fff7e2;
  border-radius: 50%;
  background: linear-gradient(#ef6444 49%, #f7e7af 51%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.38);
  transform: translate(-50%, -50%) scale(0);
  pointer-events: none;
}
.bait-float span {
  position: absolute;
  inset: 3px;
  border-radius: inherit;
  background: rgba(255, 255, 255, 0.52);
}
.bait-float.phase-casting {
  animation: bait-fly 0.55s cubic-bezier(0.16, 0.78, 0.38, 1) forwards;
}
.bait-float.phase-waiting,
.bait-float.phase-bite,
.bait-float.phase-fighting {
  transform: translate(-50%, -50%);
  animation: bob 1.8s ease-in-out infinite;
}
.bait-float.phase-bite {
  animation: bite-bob 0.24s linear infinite;
}
.rod-holder {
  position: absolute;
  z-index: 4;
  right: -8px;
  bottom: -20%;
  width: 190px;
  height: min(95vh, 740px);
  pointer-events: none;
  transform-origin: 64% 91%;
  transition: transform 0.28s ease-out;
}
.fishing-rod {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: bottom;
  mix-blend-mode: multiply;
  filter: drop-shadow(-5px 7px 5px rgba(0, 0, 0, 0.25));
}
.rod-holder.phase-idle,
.rod-holder.phase-waiting,
.rod-holder.phase-bite,
.rod-holder.phase-lost,
.rod-holder.phase-caught {
  transform: rotate(-27deg);
}
.rod-holder.phase-fighting {
  animation: reel-rod 0.48s ease-in-out infinite;
}
.rod-holder.phase-casting {
  animation: swing-rod 0.72s cubic-bezier(0.18, 0.76, 0.22, 1) both;
}
.ripple {
  position: absolute;
  z-index: 1;
  width: 20px;
  aspect-ratio: 1;
  border: 2px solid rgba(255, 255, 255, 0.87);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: ripple 1.2s ease-out forwards;
}
.ripple::after {
  content: "";
  position: absolute;
  inset: 6px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: inherit;
}
.scene-status {
  position: absolute;
  z-index: 3;
  bottom: 19px;
  left: 21px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 13px;
  border-radius: 11px;
  color: white;
  font-size: 11px;
  font-weight: 650;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9bdf73;
  box-shadow: 0 0 0 3px rgba(155, 223, 115, 0.18);
}
.scene-status.active .status-dot {
  background: #ffc653;
  animation: pulse 0.8s infinite;
}
.bite-alert {
  position: absolute;
  z-index: 6;
  top: 42%;
  left: 50%;
  padding: 10px 18px;
  border: 2px solid #fff1bd;
  border-radius: 11px;
  background: #c24d36;
  box-shadow:
    0 4px 0 #742c25,
    0 0 26px rgba(255, 169, 79, 0.7);
  color: white;
  font-size: 14px;
  font-weight: 950;
  letter-spacing: 0.09em;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.7);
  pointer-events: none;
}
.bite-alert.visible {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
  animation: bite-alert 0.48s ease-in-out infinite alternate;
}
@keyframes cast-line {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes reel-line {
  to {
    stroke-dashoffset: -40;
  }
}
@keyframes bait-fly {
  0% {
    transform: translate(40%, 105%) scale(0.2);
    opacity: 0;
  }
  42% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
  }
}
@keyframes swing-rod {
  0% {
    transform: rotate(-44deg);
  }
  36% {
    transform: rotate(21deg);
  }
  100% {
    transform: rotate(-27deg);
  }
}
@keyframes reel-rod {
  0%,
  100% {
    transform: rotate(-27deg);
  }
  50% {
    transform: rotate(-17deg);
  }
}
@keyframes bob {
  50% {
    transform: translate(-50%, calc(-50% - 4px));
  }
}
@keyframes bite-bob {
  50% {
    transform: translate(-50%, calc(-50% - 8px)) scale(1.3);
  }
}
@keyframes bite-alert {
  to {
    transform: translate(-50%, -50%) scale(1.08);
  }
}
@keyframes ripple {
  to {
    width: 180px;
    opacity: 0;
  }
}
@keyframes invalid-tap {
  0% {
    opacity: 0;
    transform: translate(-50%, -35%);
  }
  20%,
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -70%);
  }
}
@keyframes pulse {
  50% {
    transform: scale(1.65);
    opacity: 0.45;
  }
}
.guide-button {
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(17, 38, 27, 0.72);
  box-shadow: 0 6px 18px rgba(9, 20, 14, 0.16);
  color: white;
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  backdrop-filter: blur(10px);
}
@media (max-width: 620px) {
  .weather {
    display: none;
  }
  .scene-top {
    top: 13px;
    left: 13px;
  }
  .players-button { font-size: 0; padding: 9px; }
  .players-button b { margin: 0; }
  .scene-instruction {
    font-size: 9px;
  }
  .scene-status {
    bottom: 12px;
    left: 12px;
  }
}
</style>
