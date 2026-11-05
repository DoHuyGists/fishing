<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useFishingStore } from "../../../stores/fishing";
import { TENSION_SCALE } from "../../../data/tensionChallenge";
import LineTensionMeter from "./LineTensionMeter.vue";

const store = useFishingStore();
const challenge = computed(() => store.tensionChallenge);
const ready = computed(() => store.tensionStartedAt === null);
const tension = computed(() => (store.tensionFight?.tension ?? 0) / TENSION_SCALE);
const distance = computed(() => Math.max(0, (store.tensionFight?.distance ?? 0) / TENSION_SCALE));
const remaining = computed(() => challenge.value
  ? Math.max(0, Math.ceil((challenge.value.expiresAt - challenge.value.startedAt) / 1000 - (store.tensionFight?.tick ?? 0) / challenge.value.config.tickRate)) : 0);
let frame = 0;
let pointerHeld = false;
let spaceHeld = false;

function loop(now: number) {
  store.advanceTensionFight(now);
  frame = requestAnimationFrame(loop);
}
function updateInput() {
  store.setTensionReeling(pointerHeld || spaceHeld);
}
function holdPointer(event: PointerEvent) {
  if (event.button !== 0) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  pointerHeld = true;
  updateInput();
}
function releasePointer() {
  pointerHeld = false;
  updateInput();
}
function onKeyDown(event: KeyboardEvent) {
  if (event.code !== "Space" || (event.target instanceof HTMLElement && event.target.matches("input, textarea, select, [contenteditable=true]"))) return;
  event.preventDefault();
  spaceHeld = true;
  updateInput();
}
function onKeyUp(event: KeyboardEvent) {
  if (event.code !== "Space") return;
  event.preventDefault();
  spaceHeld = false;
  updateInput();
}
function releaseAll() {
  pointerHeld = false;
  spaceHeld = false;
  updateInput();
}
function onVisibilityChange() {
  if (document.hidden) releaseAll();
}
onMounted(() => {
  frame = requestAnimationFrame(loop);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", onVisibilityChange);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", releaseAll);
  document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>

<template>
  <section v-if="challenge" class="flex min-w-0 flex-col gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-[#24352a]">
    <div class="flex justify-between text-xs font-semibold">
      <span>{{ ready ? 'Cá lớn cắn câu!' : 'Đấu sức với cá' }}</span><span>{{ ready ? 'Sẵn sàng' : `${remaining} giây` }}</span>
    </div>
    <LineTensionMeter :tension="tension" :safe-min="challenge.config.safeMin" :safe-max="challenge.config.safeMax" :max="challenge.config.maxTension" />
    <div class="flex justify-between text-xs"><span>Khoảng cách</span><span>{{ distance.toFixed(1) }} m</span></div>
    <div class="h-2 overflow-hidden rounded-full bg-[#cbd9c6]" role="progressbar" aria-label="Khoảng cách cá" :aria-valuenow="distance" :aria-valuemin="0" :aria-valuemax="challenge.config.startDistance">
      <div class="h-full bg-sky-600" :style="{ width: Math.min(100, distance / challenge.config.startDistance * 100) + '%' }" />
    </div>
    <p class="m-0 text-xs" aria-live="polite">{{ store.castPhase === 'submitting' ? 'Đang xác nhận kết quả...' : store.isStartingTensionChallenge ? 'Đang bắt đầu đấu sức với cá...' : ready ? 'Giữ nút hoặc Space để bắt đầu. Cá chưa giật dây trong lúc bạn chuẩn bị.' : 'Giữ nút hoặc Space để thu dây, thả để nhả dây.' }}</p>
    <button type="button" class="touch-none select-none rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :class="{ 'bg-emerald-900': store.tensionReeling }" :disabled="store.castPhase !== 'bite'" :aria-pressed="store.tensionReeling" @pointerdown.prevent="holdPointer" @pointerup="releasePointer" @pointercancel="releasePointer" @lostpointercapture="releasePointer">
      {{ store.isStartingTensionChallenge ? 'Đang bắt đầu...' : ready ? 'Giữ để bắt đầu đấu sức' : store.tensionReeling ? 'Đang thu dây — thả để nhả' : 'Thu dây (giữ)' }}
    </button>
  </section>
</template>
