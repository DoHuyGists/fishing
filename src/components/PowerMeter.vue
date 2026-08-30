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
  <section class="power-meter p-3 px-3.5 rounded-[15px] border border-[#e3e0d8] bg-[#fffefa]">
    <div class="power-title flex items-center gap-2 text-[#385645]">
      <span class="grid place-items-center w-[27px] h-[27px] rounded-lg bg-[#f8e6b8] text-[#be7b1d] text-[22px] font-black">↯</span>
      <div class="flex-1">
        <strong class="block text-[11px]">Lực kéo</strong><small class="block mt-0.5 text-[#879188] text-[9px]">{{ store.canPull ? "Giữ để tăng, buông để giảm" : "Chờ cá cắn câu" }}</small>
      </div>
      <b class="text-[13px]" :class="store.tensionState === 'danger' ? 'text-[#e8593f]' : 'text-[#e29a31]'">{{ Math.round(store.tension) }}%</b>
    </div>
    <div class="power-track relative h-2 my-2.5 overflow-hidden rounded-full bg-[#e6e9df]">
      <span class="absolute z-[1] top-0 bottom-0 left-[28%] w-[54%] bg-[rgba(118,175,83,0.26)]"></span>
      <div class="relative z-[2] h-full rounded-[inherit] bg-[linear-gradient(90deg,#8dbb64,#f1bd4e_70%,#e66f44)] transition-[width] duration-[0.06s] ease-linear" :style="{ width: `${store.tension}%` }">
        <i class="absolute right-0 -top-0.5 w-1 h-3 rounded-[3px] bg-white not-italic"></i>
      </div>
    </div>
    <div class="flex justify-between text-[#617363] text-[9px] font-bold">
      <span>Tiến độ kéo cá</span><b class="text-[#e29a31] text-[13px]">{{ Math.round(store.catchProgress) }}%</b>
    </div>
    <div class="relative h-[5px] my-[5px] mb-2.5 overflow-hidden rounded-full bg-[#e6e9df]">
      <i class="block h-full rounded-[inherit] bg-[#75b865] transition-[width] duration-100 ease-linear not-italic" :style="{ width: `${store.catchProgress}%` }"></i>
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
        @pointerdown.prevent="beginPull"
        @pointerup="releasePull"
        @pointerleave="releasePull"
        @pointercancel="releasePull"
      >
        <span class="mr-[7px] text-[#ffe18a] text-base">⌁</span>{{ store.isPulling ? "Đang kéo cần..." : "Nhấn giữ để kéo" }}
      </button>
    </div>
  </section>
</template>
