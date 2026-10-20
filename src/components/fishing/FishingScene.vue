<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { isPointInWater } from "../../data/fishingMap";
import { useFishingStore } from "../../stores/fishing";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import ZoneWeather from "./ZoneWeather.vue";
import { supabaseUserInAreaRepository } from "../../data/supabaseUserInAreaRepository";
import { useDayPhaseStore } from "../../stores/dayPhase.ts";
import { useUserInAreaStore } from "../../stores/userInArea.ts";

const environment = import.meta.env.VITE_ENVIRONTMENT;

//
const isDevMode = ref(false);
const waterBoundary = ref<any[]>([
  { x: 0, y: 100 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]);
const waterBoundaryPoints = computed(() => waterBoundary.value.map(({ x, y }) => `${x},${y}`).join(" "));
//

const router = useRouter();
const dayPhaseStore = useDayPhaseStore();
const fishingStore = useFishingStore();
const isLeaving = ref(false);
const showExitConfirmation = ref(false);
const userInAreaStore = useUserInAreaStore();
const tripCaughtCount = ref(0);
let realtimeSubscription: ReturnType<typeof supabaseUserInAreaRepository.subscribeToAreaUsers> | null = null;

watch(() => fishingStore.castPhase, (phase) => {
  if (phase === "caught") tripCaughtCount.value++;
});

function handleBackToMap() {
  showExitConfirmation.value = false;
  router.push({ name: "home" });
}

// 2. Quản lý toàn bộ việc rời bãi câu ở Router Guard
onBeforeRouteLeave(async (to) => {
  // Nếu chuyển sang trang khác "fishing" và chưa xử lý rời bãi
  if (to.name !== "fishing" && !isLeaving.value) {
    isLeaving.value = true;
    try {
      await supabaseUserInAreaRepository.setUserLeaveArea();
    } catch (err) {
      console.error("Lỗi khi cập nhật trạng thái rời bãi câu:", err);
    } finally {
      isLeaving.value = false;
    }
  }
  return true;
});

watch(() => userInAreaStore.userInArea?.area_id, (areaId) => {
  if (areaId) {
    fishingStore.initializeFishingArea(areaId as string);
  }
})

watch(()=> fishingStore.currentArea, (newArea) => {
  dayPhaseStore.setCurrentScenePhase(newArea);
})


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
const castClass = computed(() => `phase-${fishingStore.castPhase}`);
const linePath = computed(() => {
  const { x, y } = fishingStore.baitPosition;
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
  if (fishingStore.castPhase !== "bite") {
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
  () => fishingStore.castPhase,
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
);


const now = ref(new Date());
let clockTimer: number | undefined;
let rodPositionFrame: number | undefined;

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
  clockTimer = window.setInterval(() => (now.value = new Date()), 1000);
  trackRodPosition();
  window.addEventListener("resize", updateRodPosition);
});
onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer);
  if (rodPositionFrame) window.cancelAnimationFrame(rodPositionFrame);
  if (biteMotionFrame !== undefined) window.cancelAnimationFrame(biteMotionFrame);
  window.removeEventListener("resize", updateRodPosition);
  if (realtimeSubscription) {
    supabaseUserInAreaRepository.unsubscribe(realtimeSubscription);
    realtimeSubscription = null;
  }
});


const timeLabel = computed(() =>
  now.value.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
);

function makeBoundary(event: MouseEvent) {
  const scene = event.currentTarget as HTMLElement;
  const bounds = scene.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
  const insertIndex = waterBoundary.value.length - 2;
  waterBoundary.value.splice(insertIndex, 0, { x, y });
  console.log(waterBoundary.value);
}

function castAt(event: MouseEvent) {
  const scene = event.currentTarget as HTMLElement;
  const bounds = scene.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
  if (!isPointInWater({ x, y }, fishingStore.currentArea.fishingBoundary)) {
    invalidTap.value = true;
    fishingStore.rejectCast();
    window.setTimeout(() => (invalidTap.value = false), 520);
    return;
  }
  fishingStore.castTo(x, y);
  ripple.value = true;
  window.setTimeout(() => (ripple.value = false), 900);
}

function handleClickOnScene(event: MouseEvent) {
  if (isDevMode.value) {
    makeBoundary(event);
  } else {
    castAt(event);
  }
}

</script>

<template>
  <section class="fishing-scene" @contextmenu.prevent="">
    <img :src="dayPhaseStore.currentScenePhace" alt="Ao câu trong rừng" class="pond-image" draggable="false" ref="sceneElement"
      @click="handleClickOnScene" />
    <div class="scene-shade"></div>
    <div class="absolute top-2 left-2 text-white flex justify-between items-start">
      <div class="flex flex-col gap-2">
        <div class="location">
          <div class="w-10 h-10 overflow-hidden">
            <img :src="dayPhaseStore.currentPhase.icon" :alt="dayPhaseStore.currentPhase.label" class="location-icon" />
          </div>
          <div>
            <strong>{{ timeLabel }}</strong>
            <small>{{ dayPhaseStore.currentPhase.label }}</small>
            <ZoneWeather :area-id="userInAreaStore.userInArea?.area_id as string | null" />
          </div>
        </div>
        <div class="backdrop-blur-2xl h-fit w-fit rounded p-1">
          <button type="button"
            class="text-sm text-red-500 bg-transparent border-0 cursor-pointer font-medium p-0 hover:underline disabled:opacity-50"
            :disabled="isLeaving" @click="showExitConfirmation = true">
            {{ isLeaving ? "Đang quay lại..." : "Kết thúc chuyến câu" }}
          </button>
        </div>
      </div>
      <div class="flex gap-1 justify-end flex-wrap">
        <button type="button" class="guide-button" @click.stop="fishingStore.openLakeGuide">Cá trong hồ</button>
        <button type="button" class="players-button" @click.stop="fishingStore.openPlayers">
          Người câu <b>{{ fishingStore.nearbyPlayers.length }}</b>
        </button>
        <button type="button" class="bag-button" @click.stop="fishingStore.openBag">
          Túi cá <b>{{ fishingStore.inventory.length }}</b>
        </button>
        <label v-if="environment == 'Development'" class="select-none cursor-pointer">Dev mode <input
            v-model="isDevMode" type="checkbox" /> </label>
      </div>
    </div>

    <!-- <div class="scene-instruction">Chạm mặt hồ để vung cần đến điểm đó</div> -->
    <div class="water-glow"></div>
    <svg v-if="isDevMode" class="water-boundary-debug" viewBox="0 0 100 100" preserveAspectRatio="none"
      aria-hidden="true">
      <polygon :points="waterBoundaryPoints" />
    </svg>
    <div v-if="invalidTap" class="invalid-tap">Chọn phần mặt nước</div>
    <div v-if="ripple" class="ripple"
      :style="{ left: `${fishingStore.baitPosition.x}%`, top: `${fishingStore.baitPosition.y}%` }"></div>
    <svg class="casting-line" :class="castClass" viewBox="0 0 100 100" preserveAspectRatio="none" pathLength="100"
      aria-hidden="true">
      <path :d="linePath" />
    </svg>
    <div class="bait-float" :class="castClass"
      :style="{ left: `${fishingStore.baitPosition.x + biteOffset.x}%`, top: `${fishingStore.baitPosition.y + biteOffset.y}%` }">
      <span></span>
    </div>
    <div class="rod-holder" :class="castClass" aria-hidden="true">
      <img src="/fishing-rob.png" alt="" class="fishing-rod" />
      <span ref="rodLineAnchor" class="rod-line-anchor"></span>
    </div>
    <div class="bite-alert" :class="{ visible: fishingStore.castPhase === 'bite' }">! CÁ CẮN CÂU !</div>
    <div class="scene-status" :class="{ active: fishingStore.castPhase !== 'idle' }">
      <span class="status-dot"></span>{{ fishingStore.castMessage }}
    </div>
    <Teleport to="body">
      <Transition name="exit-dialog">
        <div v-if="showExitConfirmation"
          class="fixed z-[40] inset-0 grid place-items-center p-5 bg-[rgba(4,17,11,0.72)] backdrop-blur-[7px]"
          role="presentation" @click.self="showExitConfirmation = false">
          <section
            class="w-[min(380px,100%)] p-5 border border-[rgba(255,226,149,0.5)] rounded-[20px] bg-[linear-gradient(145deg,#1b4531,#0f2e1f)] shadow-[0_24px_70px_rgba(0,0,0,0.6)] text-[#f4f0df] text-center"
            role="dialog" aria-modal="true" aria-labelledby="confirm-exit-title">
            <h2 id="confirm-exit-title" class="m-0 text-lg font-bold text-[#e8bd62]">Kết thúc chuyến câu?</h2>
            <p class="my-4 text-sm text-[#c8dccb] leading-relaxed">
              Chuyến này bạn đã câu được <strong class="text-white">{{ tripCaughtCount }}</strong> con cá.
              Bạn có chắc chắn muốn quay lại bản đồ không?
            </p>
            <div class="flex justify-center gap-3 mt-5">
              <button type="button"
                class="px-4 py-2 border border-[rgba(255,255,255,0.2)] rounded-xl bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-white text-xs font-semibold transition-colors cursor-pointer"
                @click="showExitConfirmation = false">
                Ở lại câu
              </button>
              <button type="button"
                class="px-4 py-2 border border-[#e65c5c] rounded-xl bg-[#c23b3b] hover:bg-[#d94848] text-white text-xs font-bold shadow-[0_4px_12px_rgba(194,59,59,0.4)] transition-colors cursor-pointer disabled:opacity-50"
                :disabled="isLeaving" @click="handleBackToMap">
                {{ isLeaving ? "Đang quay lại..." : "Kết thúc chuyến câu" }}
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style lang="css" scoped>
.exit-dialog-enter-active,
.exit-dialog-leave-active {
  transition: opacity 0.18s ease;
}

.exit-dialog-enter-from,
.exit-dialog-leave-to {
  opacity: 0;
}

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
  border-radius: 9px;
  transform: scale(2);
  transform-origin: top;
  object-fit: cover;
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

.players-button {
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

.players-button b {
  display: inline-grid;
  place-items: center;
  min-width: 17px;
  height: 17px;
  margin-left: 4px;
  border-radius: 50%;
  background: #78c6b1;
  color: #173c31;
  font-size: 10px;
}

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

.water-boundary-debug {
  position: absolute;
  z-index: 2;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.water-boundary-debug polygon {
  fill: none;
  /* fill: rgba(255, 255, 255, 0.219); */
  stroke: rgb(252, 143, 1);
  stroke-width: 0.6;
  stroke-dasharray: 10 6;
  vector-effect: non-scaling-stroke;
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
  object-fit: contain;
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
    height: min(80vh, 740px);
    pointer-events: none;
    transform-origin: 64% 91%;
    transition: transform 0.28s ease-out;
  }
}
</style>
