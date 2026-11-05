<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useFishingStore } from "../../../stores/fishing.ts";
import { TENSION_SCALE } from "../../../data/tensionChallenge.ts";
import LineTensionMeter from "./LineTensionMeter.vue";
import Hint from "../../shared/Hint.vue";

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
  <section v-if="challenge" aria-label="Đấu sức với cá" class="flex min-w-0 flex-col gap-3 rounded-[20px] border border-[#cbd9c6] bg-[#f5f9f0] p-4 text-[#24352a] shadow-lg">
    <header class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" class="grid size-8 shrink-0 place-items-center rounded-xl bg-[#e2ecdc] text-lg">🎣</span>
        <span class="text-sm font-bold">{{ ready ? 'Cá cắn câu!' : 'Đấu cá' }}</span>
        <Hint label="Cách đấu sức với cá" max-width-class="max-w-[13rem]">
          Giữ nút hoặc Space để thu dây, thả để nhả. Giữ vạch trong vùng xanh và kéo cá về 0 m. Lần giữ đầu tiên bắt đầu ván đấu.
        </Hint>
      </div>
      <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#dce6d7] bg-white/70 px-2.5 py-1.5 text-xs font-semibold tabular-nums" :aria-label="ready ? 'Sẵn sàng bắt đầu' : `Thời gian còn lại: ${remaining} giây`">
        <svg v-if="!ready" aria-hidden="true" viewBox="0 0 20 20" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="11" r="6.5" /><path d="M8 1.5h4M10 4.5v-3M10 7v4l2 1.5" /></svg>
        <span v-else aria-hidden="true" class="size-1.5 rounded-full bg-emerald-600" />
        {{ ready ? 'Sẵn sàng' : `${remaining}s` }}
      </span>
    </header>

    <LineTensionMeter :tension="tension" :safe-min="challenge.config.safeMin" :safe-max="challenge.config.safeMax" :max="challenge.config.maxTension" />

    <div class="flex items-center gap-2.5 px-0.5" title="Khoảng cách cá — kéo về 0 m để thắng">
      <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5 shrink-0 text-sky-700" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c3-6 9-6 13 0-4 6-10 6-13 0ZM16 12l5-4v8l-5-4Z" /><circle cx="7" cy="11" r=".7" fill="currentColor" stroke="none" /></svg>
      <div class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#dce6d7]" role="progressbar" aria-label="Khoảng cách cá" :aria-valuenow="distance" :aria-valuemin="0" :aria-valuemax="challenge.config.startDistance" :aria-valuetext="`${distance.toFixed(1)} mét, kéo về 0 mét để thắng`">
        <div class="h-full rounded-full bg-sky-600" :style="{ width: Math.min(100, distance / challenge.config.startDistance * 100) + '%' }" />
      </div>
      <span class="shrink-0 text-sm font-bold tabular-nums">{{ distance.toFixed(1) }} <span class="text-xs font-normal text-[#6a7c6b]">m</span></span>
    </div>

    <p class="sr-only" aria-live="polite">{{ store.castPhase === 'submitting' ? 'Đang xác nhận kết quả...' : store.isStartingTensionChallenge ? 'Đang bắt đầu đấu sức với cá...' : ready ? 'Giữ nút hoặc Space để bắt đầu.' : 'Giữ nút hoặc Space để thu dây, thả để nhả dây.' }}</p>
    <button type="button" class="flex min-h-12 touch-none select-none items-center justify-center gap-2.5 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-[0_3px_0_#065f46] transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:opacity-50" :class="{ 'bg-emerald-900': store.tensionReeling }" :disabled="store.castPhase !== 'bite'" :aria-pressed="store.tensionReeling" aria-describedby="tension-control-hint" @pointerdown.prevent="holdPointer" @pointerup="releasePointer" @pointercancel="releasePointer" @lostpointercapture="releasePointer">
      <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17" /></svg>
      {{ store.castPhase === 'submitting' ? 'Đang xác nhận...' : store.isStartingTensionChallenge ? 'Đang bắt đầu...' : ready ? 'Giữ để bắt đầu' : store.tensionReeling ? 'Đang thu dây' : 'Giữ để thu dây' }}
    </button>
    <div id="tension-control-hint" class="flex items-center justify-center gap-2 text-[11px] text-[#637764]">
      <kbd class="rounded border border-[#cbd9c6] bg-white/70 px-1.5 py-0.5 font-sans text-[10px] leading-none">Space</kbd>
      <span aria-hidden="true">·</span>
      <span>Thả để nhả dây</span>
    </div>
  </section>
</template>
