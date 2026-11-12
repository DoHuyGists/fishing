<script setup lang="ts">
import type { TensionController } from "../../../types/model/fishingGameplay";
import { t as tr } from "../../../i18n";

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useFishingStore } from "../../../stores/fishing.ts";
import { TENSION_SCALE } from "../../../data/tensionChallenge.ts";
import LineTensionMeter from "./LineTensionMeter.vue";
import Hint from "../../shared/Hint.vue";


const props = defineProps<{ controller?: TensionController; untimedStart?: boolean }>();
const store = props.controller ?? useFishingStore();
const challenge = computed(() => store.tensionChallenge);
const ready = computed(() => store.tensionStartedAt === null);
const tension = computed(() => (store.tensionFight?.tension ?? 0) / TENSION_SCALE);
const distance = computed(() => Math.max(0, (store.tensionFight?.distance ?? 0) / TENSION_SCALE));
const clock = ref(performance.now());
const reelControl = ref<HTMLButtonElement | null>(null);
const remaining = computed(() => challenge.value
  ? Math.max(0, Math.ceil(ready.value
    ? (challenge.value.expiresAt - store.serverClockOffset - clock.value) / 1000
    : (challenge.value.expiresAt - challenge.value.startedAt) / 1000 - (store.tensionFight?.tick ?? 0) / challenge.value.config.tickRate)) : 0);
let frame = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let pointerHeld = false;
let spaceHeld = false;

function updateClock(now = performance.now()) {
  clock.value = now;
  store.advanceTensionFight(now);
}
function loop(now: number) {
  updateClock(now);
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
  if (event.code !== "Space" || (event.target instanceof HTMLElement && event.target !== reelControl.value && event.target.closest("input, textarea, select, button, a, [contenteditable=true]"))) return;
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
  updateClock();
}
onMounted(() => {
  // Keep checking expiry when animation frames are paused in a hidden tab.
  timer = setInterval(updateClock, 1000);
  frame = requestAnimationFrame(loop);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", onVisibilityChange);
});
onBeforeUnmount(() => {
  releaseAll();
  cancelAnimationFrame(frame);
  clearInterval(timer);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", releaseAll);
  document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>

<template>
  <section v-if="challenge" :aria-label="tr('TensionChallenge.dau_suc_voi_ca')" class="flex min-w-0 flex-col gap-1 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-1.5 text-[#24352a] shadow-lg">
    <header class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" class="grid size-6 shrink-0 place-items-center rounded-lg bg-[#e2ecdc] text-sm">🎣</span>
        <span class="text-sm font-bold">{{ ready ? tr('TensionChallenge.ca_can_cau') : tr('TensionChallenge.dau_ca') }}</span>
      </div>
      <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#dce6d7] bg-white/70 px-2 py-0.5 text-xs font-semibold tabular-nums" :aria-label="ready ? (untimedStart ? tr('TensionChallenge.bat_dau_khi_ban_san_sang') : tr('TensionChallenge.thoi_gian_con_lai_de_bat_dau_value0_giay', { value0: remaining })) : tr('TensionChallenge.thoi_gian_con_lai_value0_giay', { value0: remaining })">
        <svg v-if="!ready" aria-hidden="true" viewBox="0 0 20 20" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="11" r="6.5" /><path d="M8 1.5h4M10 4.5v-3M10 7v4l2 1.5" /></svg>
        <span v-else aria-hidden="true" class="size-1.5 rounded-full bg-emerald-600" />
        {{ ready ? (untimedStart ? tr('TensionChallenge.san_sang') : tr('TensionChallenge.bat_dau_trong_value0_s', { value0: remaining })) : `${remaining}s` }}
      </span>
    </header>

    <LineTensionMeter compact :tension="tension" :safe-min="challenge.config.safeMin" :safe-max="challenge.config.safeMax" :max="challenge.config.maxTension" />

    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-2">
    <div class="flex min-w-0 items-center gap-1.5" :title="tr('TensionChallenge.khoang_cach_ca_keo_ve_0_m_de_thang')">
      <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5 shrink-0 text-sky-700" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c3-6 9-6 13 0-4 6-10 6-13 0ZM16 12l5-4v8l-5-4Z" /><circle cx="7" cy="11" r=".7" fill="currentColor" stroke="none" /></svg>
      <div class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#dce6d7]" role="progressbar" :aria-label="tr('TensionChallenge.khoang_cach_ca')" :aria-valuenow="distance" :aria-valuemin="0" :aria-valuemax="challenge.config.startDistance" :aria-valuetext="tr('TensionChallenge.value0_met_keo_ve_0_met_de_thang', { value0: distance.toFixed(1) })">
        <div class="h-full rounded-full bg-sky-600" :style="{ width: Math.min(100, distance / challenge.config.startDistance * 100) + '%' }" />
      </div>
      <span class="shrink-0 text-sm font-bold tabular-nums">{{ distance.toFixed(1) }} <span class="text-xs font-normal text-[#6a7c6b]">m</span></span>
    </div>

    <div id="tension-control-hint" class="sr-only" aria-live="polite">{{ store.castPhase === 'submitting' ? tr('TensionChallenge.dang_xac_nhan_ket_qua') : store.isStartingTensionChallenge ? tr('TensionChallenge.dang_bat_dau_dau_suc_voi_ca') : ready ? tr('TensionChallenge.giu_nut_hoac_space_de_bat_dau') : tr('TensionChallenge.giu_nut_hoac_space_de_thu_day_tha_de_nha_day') }}</div>
    <button ref="reelControl" type="button" class="flex min-h-7 touch-none select-none items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-2 py-1 text-xs font-bold leading-4 text-white shadow-[0_2px_0_#065f46] transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:opacity-50" :class="{ 'bg-emerald-900': store.tensionReeling }" :disabled="store.castPhase !== 'bite'" :aria-pressed="store.tensionReeling" aria-describedby="tension-control-hint" @pointerdown.prevent="holdPointer" @pointerup="releasePointer" @pointercancel="releasePointer" @lostpointercapture="releasePointer">
      <svg aria-hidden="true" viewBox="0 0 24 24" class="size-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17" /></svg>
      {{ store.castPhase === 'submitting' ? tr('TensionChallenge.dang_xac_nhan') : store.isStartingTensionChallenge ? tr('TensionChallenge.dang_bat_dau') : ready ? tr('TensionChallenge.giu_de_bat_dau') : store.tensionReeling ? tr('TensionChallenge.dang_thu_day') : tr('TensionChallenge.giu_de_thu_day') }}
    </button>
    </div>
  </section>
</template>
