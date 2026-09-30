<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useFishingStore } from "../stores/fishing";

const store = useFishingStore();
const challenge = computed(() => store.challenge);
const markerPosition = ref(0);
const timeRemaining = ref(0);
let startedAt = 0;
let frameId: number | undefined;

function positionAt(elapsedMs: number, speed: number) {
  const position = ((elapsedMs / 1000) * speed) % 2;
  return position <= 1 ? position : 2 - position;
}

function stopAnimation() {
  if (frameId !== undefined) cancelAnimationFrame(frameId);
  frameId = undefined;
}

function tick(timestamp: number) {
  const currentChallenge = challenge.value;
  if (!currentChallenge || !store.canPull) {
    stopAnimation();
    return;
  }

  const elapsed = timestamp - startedAt;
  if (elapsed >= currentChallenge.max_duration_ms) {
    timeRemaining.value = 0;
    stopAnimation();
    void store.submitChallenge(false, currentChallenge.max_duration_ms);
    return;
  }

  markerPosition.value = positionAt(elapsed, currentChallenge.bar_speed);
  timeRemaining.value = currentChallenge.max_duration_ms - elapsed;
  frameId = requestAnimationFrame(tick);
}

function startAnimation() {
  stopAnimation();
  if (!challenge.value || !store.canPull) return;
  startedAt = performance.now();
  markerPosition.value = 0;
  timeRemaining.value = challenge.value.max_duration_ms;
  frameId = requestAnimationFrame(tick);
}

function finishChallenge() {
  const currentChallenge = challenge.value;
  if (!currentChallenge || !store.canPull || startedAt === 0) return;

  const elapsed = performance.now() - startedAt;
  const position = positionAt(elapsed, currentChallenge.bar_speed);
  const isSuccess =
    elapsed < currentChallenge.max_duration_ms &&
    position >= currentChallenge.target_zone_start &&
    position <= currentChallenge.target_zone_start + currentChallenge.target_zone_width;
  stopAnimation();
  void store.submitChallenge(isSuccess, elapsed);
}

watch(() => store.canPull, (isActive) => (isActive ? startAnimation() : stopAnimation()));
onBeforeUnmount(stopAnimation);
</script>

<template>
  <section class="power-meter p-3 px-3.5 rounded-[15px] border border-[#e3e0d8] bg-[#fffefa]">
    <div class="power-title flex items-center gap-2 text-[#385645]">
      <span class="grid place-items-center w-[27px] h-[27px] rounded-lg bg-[#f8e6b8] text-[#be7b1d] text-[22px] font-black">↯</span>
      <div class="flex-1">
        <strong class="block text-[11px]">Thử thách câu cá</strong><small class="block mt-0.5 text-[#879188] text-[9px]">{{ store.canPull ? "Bấm khi vạch nằm trong vùng sáng" : store.castPhase === 'waiting' ? "Đang chờ tín hiệu..." : "Chờ thả cần" }}</small>
      </div>
      <b class="text-[13px] text-[#e29a31]">{{ store.canPull ? `${Math.ceil(timeRemaining / 1000)}s` : "" }}</b>
    </div>
    <div class="power-track relative h-2 my-2.5 overflow-hidden rounded-full bg-[#e6e9df]">
      <span
        v-if="challenge && store.canPull"
        class="absolute z-[1] top-0 bottom-0 bg-[rgba(118,175,83,0.55)]"
        :style="{ left: `${challenge.target_zone_start * 100}%`, width: `${challenge.target_zone_width * 100}%` }"
      ></span>
      <i
        v-if="store.canPull"
        class="absolute z-[2] top-[-2px] w-1.5 h-3 rounded-[3px] bg-[#e66f44] not-italic"
        :style="{ left: `calc(${markerPosition * 100}% - 3px)` }"
      ></i>
    </div>
    <div class="flex justify-between text-[#617363] text-[9px] font-bold">
      <span>Thời gian thử thách</span><b class="text-[#e29a31] text-[13px]">{{ store.canPull ? `${Math.ceil(timeRemaining / 1000)} giây` : "--" }}</b>
    </div>
    <div class="relative h-[5px] my-[5px] mb-2.5 overflow-hidden rounded-full bg-[#e6e9df]">
      <i
        class="block h-full rounded-[inherit] bg-[#75b865] transition-[width] duration-100 ease-linear not-italic"
        :style="{ width: challenge && store.canPull ? `${(timeRemaining / challenge.max_duration_ms) * 100}%` : '0%' }"
      ></i>
    </div>
    <div class="mt-3 flex gap-2">
      <button
        type="button"
        class="reel-button flex-1 rounded-[10px] border border-[#d8c69b] bg-[#fff4db] px-2.5 py-2 text-[11px] font-extrabold text-[#6f5521] shadow-[0_3px_0_#e1b770] transition-all touch-none enabled:active:translate-y-[2px] enabled:active:shadow-[0_1px_0_#e1b770] disabled:cursor-not-allowed disabled:opacity-45"
        :disabled="!store.canReelIn"
        @click="store.reelInBait"
      >
        <span class="mr-[6px] text-base">↶</span>Thu mồi
      </button>
      <button
        type="button"
        class="cast-button flex-1 rounded-[10px] border-0 bg-[#3f7652] shadow-[0_4px_0_#2d593c] text-white cursor-pointer px-2.5 py-2 text-[11px] font-extrabold tracking-[0.01em] touch-none enabled:active:translate-y-[3px] enabled:active:shadow-[0_1px_0_#2d593c] disabled:cursor-not-allowed disabled:opacity-45"
        :disabled="!store.canPull"
        @click="finishChallenge"
      >
        <span class="mr-[7px] text-[#ffe18a] text-base">⌁</span>{{ store.canPull ? "Móc cá" : "Chờ tín hiệu" }}
      </button>
    </div>
  </section>
</template>
