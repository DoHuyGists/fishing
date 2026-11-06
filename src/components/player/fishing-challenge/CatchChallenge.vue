<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
const props = defineProps<{
  challenge: {
    target_zone_start: number;
    target_zone_width: number;
    bar_speed: number;
    max_duration_ms: number;
  } | null;
  active: boolean;
}>();
const emit = defineEmits<{
  complete: [success: boolean, timeSpentMs: number];
}>();

const challenge = computed(() => props.challenge);
const completed = ref(false);
const canPull = computed(() => props.active && !!challenge.value && !completed.value);
const markerPosition = ref(0);
const timeRemaining = ref(0);
let startedAt: number | null = null;
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
  if (!currentChallenge || !canPull.value || startedAt === null) {
    stopAnimation();
    return;
  }

  const elapsed = timestamp - startedAt;
  if (elapsed >= currentChallenge.max_duration_ms) {
    timeRemaining.value = 0;
    stopAnimation();
    completed.value = true;
    emit("complete", false, currentChallenge.max_duration_ms);
    return;
  }

  markerPosition.value = positionAt(elapsed, currentChallenge.bar_speed);
  timeRemaining.value = currentChallenge.max_duration_ms - elapsed;
  frameId = requestAnimationFrame(tick);
}

function startAnimation() {
  stopAnimation();
  if (!challenge.value || !canPull.value) return;
  startedAt = performance.now();
  markerPosition.value = 0;
  timeRemaining.value = challenge.value.max_duration_ms;
  frameId = requestAnimationFrame(tick);
}

function finishChallenge() {
  const currentChallenge = challenge.value;
  if (!currentChallenge || !canPull.value || startedAt === null) return;

  const elapsed = performance.now() - startedAt;
  const position = positionAt(elapsed, currentChallenge.bar_speed);
  const isSuccess =
    elapsed < currentChallenge.max_duration_ms &&
    position >= currentChallenge.target_zone_start &&
    position <= currentChallenge.target_zone_start + currentChallenge.target_zone_width;
  stopAnimation();
  completed.value = true;
  emit("complete", isSuccess, elapsed);
}

watch(
  () => [props.challenge, props.active] as const,
  () => {
    completed.value = false;
    if (canPull.value) startAnimation();
    else stopAnimation();
  },
  { immediate: true },
);
onBeforeUnmount(stopAnimation);
</script>

<template>
  <section class="power-meter p-3 px-3.5 rounded-[15px] border border-[#e3e0d8] bg-[#fffefa]">
    <div class="power-title flex items-center gap-2 text-[#385645]">
      <div class="flex-1">
        <small class="block mt-0.5 text-[#879188] text-[9px]">{{
          canPull
            ? "Bấm khi vạch nằm trong vùng sáng"
            : "Chờ bắt đầu"
        }}</small>
      </div>
      <b class="text-[13px] text-[#e29a31]">{{ canPull ? `${Math.ceil(timeRemaining / 1000)}s` : "" }}</b>
    </div>
    <div class="power-track relative h-2 my-2.5 overflow-hidden rounded-full bg-[#e6e9df]">
      <span
        v-if="challenge && canPull"
        class="absolute z-[1] top-0 bottom-0 bg-[rgba(118,175,83,0.55)]"
        :style="{ left: `${challenge.target_zone_start * 100}%`, width: `${challenge.target_zone_width * 100}%` }"
      ></span>
      <i
        v-if="canPull"
        class="absolute z-[2] top-[-2px] w-1.5 h-3 rounded-[3px] bg-[#e66f44] not-italic"
        :style="{ left: `calc(${markerPosition * 100}% - 3px)` }"
      ></i>
    </div>
    <div class="flex justify-between text-[#617363] text-[9px] font-bold">
      <span>Thời gian thử thách</span
      ><b class="text-[#e29a31] text-[13px]">{{ canPull ? `${Math.ceil(timeRemaining / 1000)} giây` : "--" }}</b>
    </div>
    <div class="relative h-[5px] my-[5px] mb-2.5 overflow-hidden rounded-full bg-[#e6e9df]">
      <i
        class="block h-full rounded-[inherit] bg-[#75b865] transition-[width] duration-100 ease-linear not-italic"
        :style="{ width: challenge && canPull ? `${(timeRemaining / challenge.max_duration_ms) * 100}%` : '0%' }"
      ></i>
    </div>
    <div class="mt-3 flex gap-2">
      <button
        type="button"
        class="cast-button flex-1 rounded-[10px] border-0 bg-[#3f7652] shadow-[0_4px_0_#2d593c] text-white cursor-pointer px-2.5 py-2 text-[11px] font-extrabold tracking-[0.01em] touch-none enabled:active:translate-y-[3px] enabled:active:shadow-[0_1px_0_#2d593c] disabled:cursor-not-allowed disabled:opacity-45"
        :disabled="!canPull"
        @click="finishChallenge"
      >
        {{ canPull ? "Móc cá" : "Chờ bắt đầu" }}
      </button>
    </div>
  </section>
</template>
