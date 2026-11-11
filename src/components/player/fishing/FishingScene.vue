<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { isPointInWater } from "../../../data/fishingMap.ts";
import type { FishingSceneContext } from "../../../data/fishingGameplay";

const props = defineProps<{ context: FishingSceneContext }>();
const sceneState = computed(() => props.context.state);

const sceneElement = ref<HTMLElement | null>(null);
const rodLineAnchor = ref<HTMLElement | null>(null);
const fishingRod = ref({
  x: 0,
  y: 0,
});
const biteOffset = ref({ x: 0, y: 0 });
const rodLineOffset = {
  x: 0,
  y: 0,
};
const ripple = ref(false);
const invalidTap = ref(false);
const castClass = computed(() => `phase-${sceneState.value.castPhase}`);
const linePath = computed(() => {
  const { x, y } = sceneState.value.baitPosition;
  const endX = x + biteOffset.value.x;
  const endY = y + biteOffset.value.y;
  const { x: rodX, y: rodY } = fishingRod.value;
  const distance = Math.hypot(endX - rodX, endY - rodY);
  const sag = Math.min(18, Math.max(8, distance * 0.18));
  const controlX = (rodX + endX) / 2;
  const controlY = (rodY + endY) / 2 + sag;
  return `M ${rodX} ${rodY} Q ${controlX} ${controlY} ${endX} ${endY}`;
});

let biteMotionFrame: number | undefined;
let biteMotionStartedAt: number | undefined;

function animateBiteMotion(timestamp: number) {
  if (sceneState.value.castPhase !== "bite") {
    biteMotionFrame = undefined;
    biteMotionStartedAt = undefined;
    biteOffset.value = { x: 0, y: 0 };
    return;
  }

  biteMotionStartedAt ??= timestamp;
  const angle = ((timestamp - biteMotionStartedAt) / 620) * Math.PI * 2;
  biteOffset.value = {
    x: Math.cos(angle) * 1.1,
    y: Math.sin(angle) * 0.55,
  };
  biteMotionFrame = window.requestAnimationFrame(animateBiteMotion);
}

watch(
  () => sceneState.value.castPhase,
  (phase) => {
    if (phase === "bite") {
      biteMotionStartedAt = undefined;
      biteMotionFrame = window.requestAnimationFrame(animateBiteMotion);
      return;
    }

    if (biteMotionFrame !== undefined) {
      window.cancelAnimationFrame(biteMotionFrame);
      biteMotionFrame = undefined;
    }
    biteMotionStartedAt = undefined;
    biteOffset.value = { x: 0, y: 0 };
  },
  { immediate: true },
);

let rodPositionFrame: number | undefined;
let invalidTapTimer: ReturnType<typeof setTimeout> | undefined;
let rippleTimer: ReturnType<typeof setTimeout> | undefined;

function updateRodPosition() {
  if (!sceneElement.value || !rodLineAnchor.value) return;

  const sceneBounds = sceneElement.value.getBoundingClientRect();
  const anchorBounds = rodLineAnchor.value.getBoundingClientRect();
  fishingRod.value = {
    x: ((anchorBounds.left + anchorBounds.width / 2 - sceneBounds.left) / sceneBounds.width) * 100 + rodLineOffset.x,
    y: ((anchorBounds.top + anchorBounds.height / 2 - sceneBounds.top) / sceneBounds.height) * 100 + rodLineOffset.y,
  };
}

function trackRodPosition() {
  updateRodPosition();
  rodPositionFrame = window.requestAnimationFrame(trackRodPosition);
}

onMounted(() => {
  trackRodPosition();
  window.addEventListener("resize", updateRodPosition);
});
onBeforeUnmount(() => {
  clearTimeout(invalidTapTimer);
  clearTimeout(rippleTimer);
  if (rodPositionFrame) window.cancelAnimationFrame(rodPositionFrame);
  if (biteMotionFrame !== undefined) window.cancelAnimationFrame(biteMotionFrame);
  window.removeEventListener("resize", updateRodPosition);
});

function castAt(event: MouseEvent) {
  if (!sceneState.value.canCast) {
    sceneState.value.castTo(sceneState.value.baitPosition.x, sceneState.value.baitPosition.y);
    return;
  }

  const scene = event.currentTarget as HTMLElement;
  const bounds = scene.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
  const boundary = sceneState.value.currentArea?.fishingBoundary;
  if (Array.isArray(boundary) && boundary.length >= 3 && !isPointInWater({ x, y }, boundary)) {
    invalidTap.value = true;
    sceneState.value.rejectCast();
    clearTimeout(invalidTapTimer);
    invalidTapTimer = setTimeout(() => (invalidTap.value = false), 520);
    return;
  }
  sceneState.value.castTo(x, y);
  ripple.value = true;
  clearTimeout(rippleTimer);
  rippleTimer = setTimeout(() => (ripple.value = false), 900);
}
</script>

<template>
  <section class="fishing-scene" @contextmenu.prevent="">
    <img
      :src="context.sceneImage"
      alt="Khung cảnh bãi câu"
      class="pond-image"
      draggable="false"
      ref="sceneElement"
      @click="castAt"
    />
    <div class="scene-shade"></div>

    <!-- <div class="scene-instruction">Chạm mặt hồ để vung cần đến điểm đó</div> -->
    <div class="water-glow"></div>
    <div v-if="invalidTap" class="invalid-tap">Chọn phần mặt nước</div>
    <div
      v-if="ripple"
      class="ripple"
      :style="{ left: `${sceneState.baitPosition.x}%`, top: `${sceneState.baitPosition.y}%` }"
    ></div>
    <svg
      class="casting-line"
      :class="castClass"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      pathLength="100"
      aria-hidden="true"
    >
      <path :d="linePath" />
    </svg>
    <div
      class="bait-float"
      :class="castClass"
      :style="{
        left: `${sceneState.baitPosition.x + biteOffset.x}%`,
        top: `${sceneState.baitPosition.y + biteOffset.y}%`,
      }"
    >
      <span></span>
    </div>
    <div class="rod-holder" :class="castClass" aria-hidden="true">
      <img :src="context.rodImage" alt="" class="fishing-rod" />
      <span ref="rodLineAnchor" class="rod-line-anchor"></span>
    </div>
    <div class="bite-alert" :class="{ visible: sceneState.castPhase === 'bite' }">! CÁ CẮN CÂU !</div>
    <div class="scene-status" :class="{ active: sceneState.castPhase !== 'idle' }">
      <span class="status-dot"></span>{{ sceneState.castMessage }}
    </div>
  </section>
</template>

<style lang="css" scoped>
.fishing-scene {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: #294430;
}

.pond-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  cursor: crosshair;
}

.scene-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(9, 27, 20, 0.42), transparent 28%, transparent 66%, rgba(7, 29, 24, 0.24));
  pointer-events: none;
}

.weather,
.scene-status {
  backdrop-filter: blur(10px);
  background: rgba(17, 38, 27, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 6px 18px rgba(9, 20, 14, 0.16);
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
  stroke-width: 0.3;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
}

.casting-line.phase-idle path,
.casting-line.phase-lost path,
.casting-line.phase-caught path {
  opacity: 0;
}

.casting-line.phase-casting path {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
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
  height: min(80vh, 740px);
  pointer-events: none;
  transform-origin: 64% 91%;
  transition: transform 0.28s ease-out;
}

.fishing-rod {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: bottom;
  mix-blend-mode: multiply;
  filter: drop-shadow(-5px 7px 5px rgba(0, 0, 0, 0.25));
}

.rod-line-anchor {
  position: absolute;
  top: 2.2%;
  left: 47%;
  width: 1px;
  height: 1px;
  pointer-events: none;
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
  animation: ripple 1s linear forwards;
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
  z-index: 6;
  bottom: 19px;
  right: 21px;
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
    transform: translate(-50%, -50%) scale(1.3);
  }
}

@keyframes bite-alert {
  to {
    transform: translate(-50%, -50%) scale(1.08);
  }
}

@keyframes ripple {
  to {
    width: 100px;
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

@media (max-width: 620px) {
  .weather {
    display: none;
  }

  .scene-instruction {
    font-size: 9px;
  }

  .scene-status {
    bottom: 12px;
    left: 12px;
  }

  .rod-holder {
    position: absolute;
    z-index: 4;
    right: -8px;
    bottom: -10%;
    width: 90px;
    height: auto;
    aspect-ratio: 254 / 1024;
    pointer-events: none;
    transform-origin: 64% 91%;
    transition: transform 0.28s ease-out;
  }
}
</style>
