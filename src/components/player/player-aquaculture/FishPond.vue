<script setup lang="ts">
import type { AquaculturePond } from "../../../types/model/aquaculture";
import { t as tr } from "../../../i18n";


import { fishImageUrl } from './pondPresentation'
import FishSwim from './FishSwim.vue'

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
        <span class="rounded-lg bg-surface/90 px-3 py-1.5 text-xs text-content">{{ pond.batches.length }} {{ tr('FishPond.lua_dang_nuoi') }}</span>
      </div>
      <span class="rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold">{{ tr('FishPond.cap') }} {{ pond.level }} · {{ pond.fish.length }} {{ tr('UserProfile.con') }}</span>
    </div>
    <div class="pond-bank relative">
      <div class="bank-grass bank-grass-left" aria-hidden="true" />
      <div class="bank-grass bank-grass-right" aria-hidden="true" />
      <div class="pond-water relative h-full overflow-hidden">
        <div class="water-light pointer-events-none absolute inset-0" aria-hidden="true" />
        <div class="water-ripples pointer-events-none absolute inset-0" aria-hidden="true"><i /><i /><i /></div>
        <span v-if="pond.fish.some(f => f.status === 'ready')" class="absolute right-4 top-4 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-gold">{{ tr('FishPond.co_ca_truong_thanh') }}</span>
        <div v-if="!pond.fish.length" class="empty-plaque absolute inset-x-4 top-1/2 m-0 text-center text-sm">{{ tr('FishPond.ao_da_san_sang_tha_lua_ca_dau_tien_nhe') }}</div>
        <div class="swimming-area absolute inset-x-4 bottom-5 top-14" aria-hidden="true">
          <FishSwim
            v-for="(fish, i) in swimmers"
            :key="fish.id"
            class="fish"
            :class="{ 'special-fish': fish.special }"
            :src="fishImageUrl(fish.image)"
            :size="68 + fish.progress * .4"
            :initial-x=".2 + (i * .23) % .6"
            :lane=".15 + i * .19"
            :phase-offset="i * 2.3"
            :paused="paused"
          >
            <span v-if="fish.special" class="fish-effects">
              <span class="special-sparkle">✦</span>
              <span class="special-sparkle special-sparkle-small">✧</span>
            </span>
          </FishSwim>
        </div>
        <div class="lily-pad lily-one" aria-hidden="true" />
        <div class="lily-pad lily-two" aria-hidden="true" />
      </div>
      <span class="pond-dock" aria-hidden="true" />
    </div>
    <div class="mt-5 rounded-xl border border-white/80 bg-white/85 p-3">
      <div class="flex justify-between gap-2 text-xs"><span>{{ tr('FishPond.suc_chua_da_dung') }}</span><b>{{ pond.used_capacity }} / {{ pond.capacity }}</b></div>
      <div class="my-2 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" :aria-label="tr('FishPond.suc_chua_ao')" :aria-valuenow="pond.used_capacity" :aria-valuemin="0" :aria-valuemax="pond.capacity">
        <div class="h-full rounded-full bg-accent" :style="{ width: (pond.used_capacity / pond.capacity * 100) + '%' }" />
      </div>
      <div class="m-0 text-[11px] text-content">{{ tr('Fishfarm.con') }} {{ pond.available_capacity }} {{ tr('FishPond.suc_chua_de_tha_ca_tong_suc_chua_ca_phai_nho_hon') }} {{ pond.capacity }}.</div>
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
  border: 1px solid var(--color-content);
  border-radius: 30px;
  background: var(--color-surface);
  box-shadow: 0 6px 0 var(--color-content);
}

.pond-water {
  min-height: 260px;
  border: 2px solid var(--color-primary);
  border-radius: 19px 26px 20px 25px;
  background: linear-gradient(155deg, var(--color-accent) 0%, var(--color-sky) 34%, var(--color-primary) 75%, var(--color-primary) 100%);
  box-shadow: inset 0 5px 9px color-mix(in srgb, var(--color-primary) 30.196%, transparent), inset 0 -3px 5px color-mix(in srgb, var(--color-surface) 30.196%, transparent);
}

.water-light {
  background: repeating-linear-gradient(165deg, transparent 0 32px, color-mix(in srgb, var(--color-surface) 6.275%, transparent) 33px 35px, transparent 36px 56px);
}

.water-ripples i {
  position: absolute;
  width: 45px;
  height: 9px;
  border: 1px solid color-mix(in srgb, var(--color-surface) 25.098%, transparent);
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
  color: var(--color-surface);
  text-shadow: 0 1px 2px var(--color-primary);
}

.bank-grass {
  position: absolute;
  z-index: 2;
  width: 18px;
  height: 21px;
  background: var(--color-accent);
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
  border: 1px solid var(--color-accent);
  border-radius: 50%;
  background: var(--color-accent);
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
  background: var(--color-accent);
}

.pond-dock {
  position: absolute;
  z-index: 3;
  left: 50%;
  bottom: -11px;
  width: 36px;
  height: 23px;
  transform: translateX(-50%) rotate(-3deg);
  border: 2px solid var(--color-gold);
  border-radius: 2px;
  background: var(--color-gold);
}

.swimming-area .fish {
  position: absolute;
  inset: 0;
  mix-blend-mode: multiply;
  opacity: .9;
}

.swimming-area .special-fish {
  mix-blend-mode: normal;
  opacity: 1;
  isolation: isolate;
}

.fish-effects {
  position: absolute;
  inset: 0;
  isolation: isolate;
}

.special-sparkle {
  position: absolute;
  right: 20%;
  top: -18%;
  color: var(--color-surface);
  font-size: 24px;
  line-height: 1;
  text-shadow: 0 0 3px var(--color-white), 0 0 8px var(--color-gold);
  animation: golden-sparkle 4s ease-in-out infinite;
}

.special-sparkle-small {
  right: auto;
  left: 15%;
  top: 55%;
  font-size: 17px;
  animation-delay: -2s;
}

.motion-paused .special-sparkle {
  animation-play-state: paused;
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

@media (prefers-reduced-motion: reduce) {

  .special-sparkle {
    animation: none;
  }
}
</style>
