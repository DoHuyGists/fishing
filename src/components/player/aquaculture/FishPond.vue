<script setup lang="ts">
import type { AquaculturePond } from '../../../data/aquaculture'
import { fishImageUrl } from './pondPresentation'

defineProps<{
  pond: AquaculturePond
  swimmers: { id: string; image: string | null; special: boolean; progress: number }[]
  paused?: boolean
}>()
</script>

<template>
  <section class="pond-plot" :class="{ 'motion-paused': paused }" :aria-label="pond.name">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div class="flex gap-2 items-center">
        <div class="m-0 mt-1 text-xl font-bold">{{ pond.name }}</div>
        <span class="rounded-lg bg-[#f5f9f0]/90 px-3 py-1.5 text-xs text-emerald-900">{{ pond.batches.length }} lứa đang nuôi</span>
      </div>
      <span class="rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold">Cấp {{ pond.level }} · {{ pond.fish.length }} con</span>
    </div>
    <div class="pond-bank relative">
      <div class="bank-grass bank-grass-left" aria-hidden="true" />
      <div class="bank-grass bank-grass-right" aria-hidden="true" />
      <div class="pond-water relative h-full overflow-hidden">
        <div class="water-light pointer-events-none absolute inset-0" aria-hidden="true" />
        <div class="water-ripples pointer-events-none absolute inset-0" aria-hidden="true"><i /><i /><i /></div>
        <span v-if="pond.fish.some(f => f.status === 'ready')" class="absolute right-4 top-4 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">Có cá trưởng thành</span>
        <p v-if="!pond.fish.length" class="empty-plaque absolute inset-x-4 top-1/2 m-0 text-center text-sm">Ao đã sẵn sàng. Thả lứa cá đầu tiên nhé!</p>
        <div class="swimming-area absolute inset-x-4 bottom-5 top-14" aria-hidden="true">
          <span v-for="(fish, i) in swimmers" :key="fish.id" class="fish absolute block" :class="{ 'special-fish': fish.special }" :style="{ '--fish-width': (68 + fish.progress * .4) + 'px', top: (15 + i * 19) + '%', animationDuration: (150 + i * 20) + 's', animationDelay: -(i * 43) + 's' }">
            <img :src="fishImageUrl(fish.image)" alt="" class="fish-image" decoding="async" draggable="false" />
            <template v-if="fish.special">
              <span class="special-sparkle">✦</span>
              <span class="special-sparkle special-sparkle-small">✧</span>
            </template>
          </span>
        </div>
        <div class="lily-pad lily-one" aria-hidden="true" />
        <div class="lily-pad lily-two" aria-hidden="true" />
      </div>
      <span class="pond-dock" aria-hidden="true" />
    </div>
    <div class="mt-5 rounded-xl border border-white/80 bg-white/85 p-3">
      <div class="flex justify-between gap-2 text-xs"><span>Sức chứa đã dùng</span><b>{{ pond.used_capacity }} / {{ pond.capacity }}</b></div>
      <div class="my-2 h-2 overflow-hidden rounded-full bg-[#dfe8d8]" role="progressbar" aria-label="Sức chứa ao" :aria-valuenow="pond.used_capacity" :aria-valuemin="0" :aria-valuemax="pond.capacity">
        <div class="h-full rounded-full bg-emerald-600" :style="{ width: (pond.used_capacity / pond.capacity * 100) + '%' }" />
      </div>
      <p class="m-0 text-[11px] text-stone-600">Còn {{ pond.available_capacity }} sức chứa để thả cá. Tổng sức chứa cá phải nhỏ hơn {{ pond.capacity }}.</p>
    </div>
  </section>
</template>

<style scoped>
.pond-plot {
  display: grid;
  grid-template-rows: auto minmax(282px, 1fr) auto;
  width: 100%;
  min-height: 400px;
}

.pond-bank {
  padding: 10px;
  border: 1px solid #a8b09a;
  border-radius: 30px;
  background: #b5bda3;
  box-shadow: 0 6px 0 #738061;
}

.pond-water {
  min-height: 260px;
  border: 2px solid #3e7e7c;
  border-radius: 19px 26px 20px 25px;
  background: linear-gradient(155deg, #79c4bd 0%, #4fa9ae 34%, #338b9c 75%, #3c97a0 100%);
  box-shadow: inset 0 5px 9px #255b654d, inset 0 -3px 5px #d2f1c84d;
}

.water-light {
  background: repeating-linear-gradient(165deg, transparent 0 32px, #e1fff910 33px 35px, transparent 36px 56px);
}

.water-ripples i {
  position: absolute;
  width: 45px;
  height: 9px;
  border: 1px solid #d8ffff40;
  border-radius: 50%;
}

.water-ripples i:nth-child(1) {
  left: 24%;
  top: 43%;
}

.water-ripples i:nth-child(2) {
  left: 65%;
  top: 73%;
  width: 30px;
}

.water-ripples i:nth-child(3) {
  left: 55%;
  top: 20%;
  width: 22px;
}

.empty-plaque {
  color: #e4fff4;
  text-shadow: 0 1px 2px #205b63;
}

.bank-grass {
  position: absolute;
  z-index: 2;
  width: 18px;
  height: 21px;
  background: #688c48;
  clip-path: polygon(0 100%, 2% 20%, 34% 70%, 39% 0, 62% 72%, 95% 17%, 100% 100%);
}

.bank-grass-left {
  bottom: 5px;
  left: -7px;
  transform: rotate(-18deg);
}

.bank-grass-right {
  top: -9px;
  right: 18px;
  transform: rotate(9deg);
}

.lily-pad {
  position: absolute;
  width: 19px;
  height: 12px;
  border: 1px solid #548a5c;
  border-radius: 50%;
  background: #83b971;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 46% 100%, 53% 52%, 27% 100%, 0 100%);
}

.lily-one {
  left: 9px;
  bottom: 14px;
  transform: rotate(-25deg);
}

.lily-two {
  left: 23px;
  bottom: 7px;
  width: 13px;
  height: 9px;
  transform: rotate(42deg);
  background: #a7c67b;
}

.pond-dock {
  position: absolute;
  z-index: 3;
  left: 50%;
  bottom: -11px;
  width: 36px;
  height: 23px;
  transform: translateX(-50%) rotate(-3deg);
  border: 2px solid #98774d;
  border-radius: 2px;
  background: repeating-linear-gradient(0deg, #c6a573 0 5px, #9d7e52 5px 6px);
}

.swimming-area {
  container-type: inline-size;
}

.fish {
  left: 0;
  width: var(--fish-width);
  mix-blend-mode: multiply;
  opacity: .9;
  animation: swim linear infinite;
  will-change: transform;
}

.fish-image {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
  user-select: none;
}

.special-fish {
  mix-blend-mode: normal;
  opacity: 1;
  isolation: isolate;
}

.special-fish::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: -35% -18%;
  border-radius: 50%;
  background: radial-gradient(ellipse, #fff7bdcc 0%, #ffdf6e80 32%, #ffe78a00 70%);
  animation: golden-glow 5s ease-in-out infinite;
}

.special-fish .fish-image {
  filter: brightness(1.15) saturate(1.15) drop-shadow(0 0 3px #fff6c5) drop-shadow(0 0 9px #ffd45b);
}

.special-sparkle {
  position: absolute;
  right: 20%;
  top: -18%;
  color: #fffbe6;
  font-size: 24px;
  line-height: 1;
  text-shadow: 0 0 3px #fff, 0 0 8px #ffcf45;
  animation: golden-sparkle 4s ease-in-out infinite;
}

.special-sparkle-small {
  right: auto;
  left: 15%;
  top: 55%;
  font-size: 17px;
  animation-delay: -2s;
}

.motion-paused .fish,
.motion-paused .special-fish::before,
.motion-paused .special-sparkle {
  animation-play-state: paused;
}

@keyframes golden-glow {

  0%,
  100% {
    opacity: .65;
    transform: scale(.92);
  }

  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes golden-sparkle {

  0%,
  100% {
    opacity: .5;
    transform: scale(.8) rotate(-10deg);
  }

  50% {
    opacity: 1;
    transform: scale(1.15) rotate(10deg);
  }
}

@keyframes swim {
  0% {
    transform: translateX(0) scaleX(-1);
  }

  49% {
    transform: translateX(max(0px, calc(100cqw - var(--fish-width)))) scaleX(-1);
  }

  50% {
    transform: translateX(max(0px, calc(100cqw - var(--fish-width)))) scaleX(1);
  }

  100% {
    transform: translateX(0) scaleX(1);
  }
}

@media (prefers-reduced-motion: reduce) {

  .fish,
  .special-fish::before,
  .special-sparkle {
    animation: none;
  }

  .fish:nth-child(even) {
    left: 55%;
  }
}
</style>
