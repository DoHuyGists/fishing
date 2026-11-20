<script setup lang="ts">
import type { FishingSceneContext } from "../../../types/model/fishingGameplay";
import { t as tr } from "../../../i18n";

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { isPointInWater } from "../../../data/fishingMap.ts";
import { TENSION_SCALE } from "../../../data/tensionChallenge";
import BobbingBuoy from "./BobbingBuoy.vue";
import FishingRod from "./FishingRod.vue";


const props = defineProps<{ context: FishingSceneContext }>();
const sceneState = computed(() => props.context.state);

const sceneElement = ref<HTMLElement | null>(null);
const rod = ref<InstanceType<typeof FishingRod> | null>(null);
const rodHolder = ref<HTMLElement | null>(null);
const rodReference = ref<HTMLElement | null>(null);
const restingRod = ref({ x: 100, y: 100 });
const sceneSize = ref({ width: 0, height: 0 });
let retrieveAnimation: Animation | undefined;

watch(
  () => sceneState.value.baitRetrievalSequence,
  () => {
    if (!rodHolder.value) return;
    retrieveAnimation?.cancel();
    retrieveAnimation = rodHolder.value.animate(
      [
        { transform: "rotate(-27deg)", offset: 0 },
        { transform: "rotate(-48deg)", offset: 0.28 },
        { transform: "rotate(-24deg)", offset: 0.75 },
        { transform: "rotate(-27deg)", offset: 1 },
      ],
      {
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380,
        easing: "ease-out",
        iterations: 1,
      },
    );
  },
  { flush: "post" },
);

const fishingRod = ref({
  x: 0,
  y: 0,
});
const ripple = ref(false);
const invalidTap = ref(false);
const isFighting = computed(() => sceneState.value.castPhase === "bite" && sceneState.value.tensionStartedAt !== null);
// Keep the bite pose while the server starts the challenge.
const isStartingFight = computed(() => sceneState.value.castPhase === "submitting"
  && sceneState.value.tensionStartedAt === null && sceneState.value.tensionFight?.result === "fighting");
const fishBite = computed(() => (sceneState.value.castPhase === "bite" || isStartingFight.value)
  && sceneState.value.tensionFight?.result === "fighting");
const biteIntensity = computed(() => {
  const { tensionFight: fight, tensionChallenge: challenge } = sceneState.value;
  if (!fishBite.value || !fight || !challenge) return 1;
  const stamina = Math.min(1, Math.max(0, fight.stamina / TENSION_SCALE));
  const load = Math.min(1, Math.max(0, fight.tension / TENSION_SCALE / challenge.config.maxTension));
  const burst = fight.burst > 0 && fight.burstLeft > 0 ? 0.4 : 0;
  return Math.min(2, Math.max(0.5, 0.5 + stamina * 0.7 + load * 0.4 + burst));
});
const castClass = computed(() => `phase-${isFighting.value ? "fighting" : isStartingFight.value ? "bite" : sceneState.value.castPhase}`);
const floatSide = computed<-1 | 1>(() => sceneState.value.baitPosition.x < restingRod.value.x ? -1 : 1);
const rodAngle = computed(() => {
  // Lean around the resting grip so forward/backward motion stays in the scene.
  if (isFighting.value) return -27 + floatSide.value * (sceneState.value.tensionReeling ? -14 : 14);
  if (sceneState.value.castPhase === "bite" || isStartingFight.value) return -27 - floatSide.value * 8;
  return -27;
});
const rodBend = computed(() => {
  const state = sceneState.value;
  if (state.castPhase !== "bite" && !isStartingFight.value) return 0;
  if (state.tensionStartedAt === null) return 26;

  const maxTension = state.tensionChallenge?.config.maxTension ?? 0;
  const load = maxTension > 0
    ? Math.min(1, Math.max(0, (state.tensionFight?.tension ?? 0) / TENSION_SCALE / maxTension))
    : 0;
  return 86 * Math.pow(load, 0.8) + (state.tensionReeling ? 4 * load : 0);
});
const castProgress = ref(1);
let castStartedAt = 0;
let castOrigin = { x: 0, y: 0 };
const floatDistanceRatio = computed(() => {
  const state = sceneState.value;
  const startDistance = state.tensionChallenge?.config.startDistance ?? 0;
  if (state.tensionStartedAt === null || !state.tensionFight || startDistance <= 0
    || (state.castPhase !== "bite" && state.castPhase !== "submitting")) return 1;

  // Keep the float on the water, short of the bank, until the result is confirmed.
  return Math.min(1, Math.max(0.15, state.tensionFight.distance / TENSION_SCALE / startDistance));
});
const floatPosition = computed(() => {
  const bait = sceneState.value.baitPosition;
  const ratio = floatDistanceRatio.value;
  const bank = { x: Math.min(95, Math.max(5, restingRod.value.x)), y: Math.max(95, bait.y) };
  const target = {
    x: bank.x + (bait.x - bank.x) * ratio,
    y: bank.y + (bait.y - bank.y) * ratio,
  };
  const progress = castProgress.value;
  const arcHeight = Math.min(12, Math.hypot(target.x - castOrigin.x, target.y - castOrigin.y) * 0.25);
  return {
    x: castOrigin.x + (target.x - castOrigin.x) * progress,
    y: castOrigin.y + (target.y - castOrigin.y) * progress - Math.sin(progress * Math.PI) * arcHeight,
  };
});
const buoyFrame = computed(() => {
  const dx = (fishingRod.value.x - floatPosition.value.x) * sceneSize.value.width / 100;
  const dy = (fishingRod.value.y - floatPosition.value.y) * sceneSize.value.height / 100;
  // Use a stable frame throughout the fight; rod movement must not resize the canvas.
  const width = fishBite.value ? Math.max(200, sceneSize.value.width * 2 + 40) : 200;
  const height = fishBite.value ? Math.max(200, sceneSize.value.height * 2 + 40) : 200;
  return { width, height, anchorX: 0.5 + dx / width, anchorY: 0.5 + dy / height };
});
const linePath = computed(() => {
  const { x: endX, y: endY } = floatPosition.value;
  const { x: rodX, y: rodY } = fishingRod.value;
  const distance = Math.hypot(endX - rodX, endY - rodY);
  const sag = Math.min(18, Math.max(8, distance * 0.18)) * (1 - rodBend.value / 100);
  const controlX = (rodX + endX) / 2;
  const controlY = (rodY + endY) / 2 + sag;
  return `M ${rodX} ${rodY} Q ${controlX} ${controlY} ${endX} ${endY}`;
});

let rodPositionFrame: number | undefined;
let invalidTapTimer: ReturnType<typeof setTimeout> | undefined;
let rippleTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => sceneState.value.castPhase,
  (phase) => {
    if (phase === "casting") {
      updateRodPosition();
      castOrigin = { ...fishingRod.value };
      castStartedAt = performance.now();
      castProgress.value = 0;
      ripple.value = false;
      clearTimeout(rippleTimer);
    } else if (["idle", "lost", "caught"].includes(phase)) {
      castProgress.value = 1;
      ripple.value = false;
      clearTimeout(rippleTimer);
    }
  },
);

function updateRodPosition(tip = rod.value?.getTipPosition()) {
  if (!sceneElement.value || !tip) return;

  const sceneBounds = sceneElement.value.getBoundingClientRect();
  if (!sceneBounds.width || !sceneBounds.height) return;
  if (sceneSize.value.width !== sceneBounds.width || sceneSize.value.height !== sceneBounds.height) {
    sceneSize.value = { width: sceneBounds.width, height: sceneBounds.height };
  }
  // This reference keeps the resting pose, independent of flex and player input.
  const referenceBounds = rodReference.value?.getBoundingClientRect();
  if (referenceBounds) restingRod.value = {
    x: ((referenceBounds.left - sceneBounds.left) / sceneBounds.width) * 100,
    y: ((referenceBounds.top - sceneBounds.top) / sceneBounds.height) * 100,
  };
  fishingRod.value = {
    x: ((tip.x - sceneBounds.left) / sceneBounds.width) * 100,
    y: ((tip.y - sceneBounds.top) / sceneBounds.height) * 100,
  };
}

function trackRodPosition(timestamp: number) {
  if (castProgress.value < 1) {
    castProgress.value = Math.min(1, (timestamp - castStartedAt) / 550);
    if (castProgress.value === 1) {
      ripple.value = true;
      clearTimeout(rippleTimer);
      rippleTimer = setTimeout(() => (ripple.value = false), 900);
    }
  }
  rodPositionFrame = window.requestAnimationFrame(trackRodPosition);
}

onMounted(() => {
  trackRodPosition(performance.now());
});
onBeforeUnmount(() => {
  retrieveAnimation?.cancel();
  clearTimeout(invalidTapTimer);
  clearTimeout(rippleTimer);
  if (rodPositionFrame) window.cancelAnimationFrame(rodPositionFrame);
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
}
</script>

<template>
  <section class="fishing-scene" @contextmenu.prevent="">
    <img
      v-if="context.sceneImage"
      :src="context.sceneImage"
      :alt="tr('FishingScene.khung_canh_bai_cau')"
      class="pond-image"
      draggable="false"
      ref="sceneElement"
      @click="castAt"
    />
    <div class="scene-shade"></div>

    <div v-if="invalidTap" class="invalid-tap">{{ tr('FishingScene.chon_phan_mat_nuoc') }}</div>
    <div
      v-if="ripple"
      class="ripple"
      :style="{ left: `${sceneState.baitPosition.x}%`, top: `${sceneState.baitPosition.y}%` }"
    ></div>
    <svg
      v-show="!fishBite"
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
        left: `${floatPosition.x}%`,
        top: `${floatPosition.y}%`,
        width: `${buoyFrame.width}px`,
        height: `${buoyFrame.height}px`,
      }"
    >
      <BobbingBuoy
        :size="13"
        :clickable="false"
        :fish-bite="fishBite"
        :bite-intensity="biteIntensity"
        :line-anchor-x="buoyFrame.anchorX"
        :line-anchor-y="buoyFrame.anchorY"
        ripple-color="rgba(255, 255, 255, 0.8)"
      />
    </div>
    <div class="rod-reference" aria-hidden="true">
      <span ref="rodReference" class="rod-reference-point"></span>
    </div>
    <div ref="rodHolder" class="rod-holder" :class="castClass" :style="{ '--rod-angle': `${rodAngle}deg` }" aria-hidden="true">
      <FishingRod ref="rod" :src="context.rodImage" :max-bend="rodBend" :bend-direction="floatSide" :show-line="false" @tip-change="updateRodPosition" />
    </div>
    <div class="bite-alert" :class="{ visible: sceneState.castPhase === 'bite' && !isFighting }">{{ tr('FishingScene.ca_can_cau') }}</div>
    <div class="scene-status w-fit" :class="{ active: sceneState.castPhase !== 'idle' }">
      <span class="status-dot"></span>{{ sceneState.castMessage }}
    </div>
  </section>
</template>

<style lang="css" scoped>
.fishing-scene {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: var(--color-palette-294430);
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
  color: var(--color-palette-ffcf67);
  font-size: 16px;
}

.weather i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--color-palette-d6dfd8);
}

.invalid-tap {
  position: absolute;
  z-index: 5;
  top: 50%;
  left: 50%;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(91, 39, 24, 0.86);
  color: var(--color-palette-fff2da);
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

.bait-float {
  position: absolute;
  z-index: 4;
  width: 200px;
  height: 200px;
  transform: translate(-50%, -50%) scale(0);
  pointer-events: none;
}

.bait-float.phase-casting,
.bait-float.phase-waiting,
.bait-float.phase-bite,
.bait-float.phase-fighting {
  transform: translate(-50%, -50%);
}

.rod-holder,
.rod-reference {
  position: absolute;
  z-index: 4;
  right: -8px;
  bottom: -20%;
  width: 190px;
  height: min(80vh, 740px);
  pointer-events: none;
  transform-origin: 64% 91%;
}

.rod-reference {
  visibility: hidden;
  transform: rotate(-27deg);
}

.rod-reference-point {
  position: absolute;
  left: 49%;
  top: 2.8%;
  width: 0;
  height: 0;
}

.rod-holder {
  transform: rotate(var(--rod-angle, -27deg));
  transition: transform 0.32s ease-out;
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
  bottom: 5px;
  right: 5px;
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
  background: var(--color-palette-9bdf73);
  box-shadow: 0 0 0 3px rgba(155, 223, 115, 0.18);
}

.scene-status.active .status-dot {
  background: var(--color-palette-ffc653);
  animation: pulse 0.8s infinite;
}

html.ocean-theme .fishing-scene {
  background: var(--color-ocean-deep);
}

html.ocean-theme .scene-shade {
  background: linear-gradient(180deg, rgb(16 45 70 / 42%), transparent 28%, transparent 66%, rgb(16 45 70 / 24%));
}

html.ocean-theme .weather,
html.ocean-theme .scene-status {
  border-color: rgb(242 198 109 / 45%);
  background: rgb(16 45 70 / 85%);
  color: var(--color-ocean-pearl);
  box-shadow: inset 0 1px 0 rgb(245 235 212 / 10%), 0 6px 18px rgb(0 0 0 / 20%);
}

html.ocean-theme .status-dot {
  background: var(--color-ocean-cyan);
  box-shadow: 0 0 0 3px rgb(53 185 213 / 18%);
}

html.ocean-theme .scene-status.active .status-dot {
  background: var(--color-ocean-gold);
  box-shadow: 0 0 0 3px rgb(242 198 109 / 18%);
}

.bite-alert {
  position: absolute;
  z-index: 6;
  top: 42%;
  left: 50%;
  padding: 10px 18px;
  border: 2px solid var(--color-palette-fff1bd);
  border-radius: 11px;
  background: var(--color-palette-c24d36);
  box-shadow:
    0 4px 0 var(--color-palette-742c25),
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

@keyframes reel-line {
  to {
    stroke-dashoffset: -40;
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

  .rod-holder,
  .rod-reference {
    bottom: -10%;
    width: 90px;
    height: auto;
    aspect-ratio: 254 / 1024;
  }
}
</style>
