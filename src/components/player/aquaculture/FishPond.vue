<script setup lang="ts">
import { oxygenOf, statusOf, type Pond } from '../../../stores/fishfarm'
import { statusLabel, statusChip, progressOf } from './pondPresentation'

const { pond, paused = false } = defineProps<{
  pond: Pond
  paused?: boolean
}>()

const fishes = Array.from({ length: 4 }, (_, i) => ({ top: 20 + ((i * 29) % 60), duration: 120 + i * 15, delay: -(i * 37) }))
const fishImageUrl = `${import.meta.env.BASE_URL}fish/VN/Carp.png`
</script>

<template>
  <section
    :data-pond-id="pond.id"
    class="pond-plot relative flex min-w-0 flex-col text-left"
    :class="{
      'pond-ready': pond.fishCount > 0 && pond.growth >= 100,
      'pond-empty': !pond.fishCount,
      'simulation-paused': paused,
    }"
    :aria-label="`${pond.name}, ${pond.species}: ${progressOf(pond)}`"
  >
    <div class="pond-heading flex items-center justify-between gap-2">
      <span class="flex min-w-0 items-center gap-2">
        <span class="truncate text-sm font-bold">{{ pond.name }}</span>
      </span>
      <span class="status-badge" :class="statusChip[statusOf(pond)]"><span class="status-indicator" />{{ statusLabel[statusOf(pond)] }}</span>
    </div>
    <div class="pond-bank relative mt-2 min-h-0 flex-1">
      <div class="bank-grass bank-grass-left" aria-hidden="true" /><div class="bank-grass bank-grass-right" aria-hidden="true" />
      <div class="pond-water relative h-full overflow-hidden">
        <div class="water-light pointer-events-none absolute inset-0" aria-hidden="true" /><div class="water-ripples pointer-events-none absolute inset-0" aria-hidden="true"><i /><i /><i /></div>
        <span class="species-plaque absolute left-3 top-3">{{ pond.species }}</span>
        <span v-if="pond.fishCount && pond.growth >= 100" class="ready-plaque absolute right-3 top-3">Sẵn sàng thu</span>
        <span v-else-if="!pond.fishCount" class="empty-plaque absolute inset-x-0 top-1/2 text-center text-xs">Ao đang nghỉ · Thả lứa mới</span>
        <div v-if="pond.fishCount" class="swimming-area absolute inset-x-4 bottom-2 top-7" :class="{ 'feeding-fish': pond.effect?.kind === 'feed' }" aria-hidden="true">
          <span v-for="(f, i) in fishes" :key="i" class="fish absolute block"
            :style="{
              '--fish-width': (68 + pond.growth * 0.4) + 'px',
              top: f.top + '%', animationDuration: f.duration + 's', animationDelay: f.delay + 's',
            }">
            <img :src="fishImageUrl" alt="" class="fish-image" width="1672" height="941" decoding="async" draggable="false" />
          </span>
        </div>
        <div class="lily-pad lily-one" aria-hidden="true" /><div class="lily-pad lily-two" aria-hidden="true" />
        <div v-if="pond.aerator" class="aerator absolute bottom-5 right-5" aria-hidden="true">
          <span class="aerator-ring" />
        </div>
        <div v-if="pond.effect?.kind === 'feed'" :key="`food-${pond.effect.id}`" class="pointer-events-none absolute inset-0" aria-hidden="true">
          <span v-for="n in 4" :key="n" class="pellet absolute h-1.5 w-1.5 rounded-full bg-amber-300" :style="{ left: (15 + n * 16) + '%', animationDelay: n * 0.07 + 's' }" />
        </div>
        <div v-if="pond.effect" :key="pond.effect.id" class="pond-effect pointer-events-none absolute inset-x-2 top-1/2 z-10 rounded-lg bg-white/95 px-2 py-2 text-center text-xs font-bold text-emerald-800 shadow-sm" :class="{ 'harvest-effect': pond.effect.kind === 'harvest' }">{{ pond.effect.text }}</div>
      </div>
      <span class="pond-dock" aria-hidden="true" />
    </div>
    <div class="pond-summary mt-3 rounded-xl border border-white/80 bg-white/90 px-3 py-2">
      <div class="flex items-center justify-between gap-2 text-xs"><span class="truncate font-semibold" :class="pond.fishCount && pond.fullness < 30 ? 'text-amber-800' : 'text-[#24352a]'">{{ progressOf(pond) }}</span><b class="shrink-0 text-emerald-700">{{ pond.fishCount ? Math.floor(pond.growth) + '%' : '—' }}</b></div>
      <div class="my-1.5 h-1.5 overflow-hidden rounded-full bg-[#e5edde]"><div class="meter-fill h-full rounded-full" :class="pond.growth >= 100 ? 'bg-amber-500' : 'bg-emerald-600'" :style="{ width: (pond.fishCount ? pond.growth : 0) + '%' }" /></div>
      <div class="flex items-center justify-between gap-2 text-[11px] text-stone-500"><span>{{ pond.fishCount.toLocaleString('vi-VN') }} con</span><span :class="pond.fishCount && pond.fullness < 30 ? 'text-amber-700' : ''">No {{ Math.ceil(pond.fullness) }}% <span class="mx-1 opacity-40">·</span> Oxy {{ oxygenOf(pond) }}</span></div>
    </div>
  </section>
</template>

<style scoped>
.pond-plot { width: 100%; height: 100%; gap: 4px; }
.status-badge { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; border: 1px solid #ffffff70; border-radius: 20px; padding: 3px 6px; font-size: 10px; }
.status-indicator { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.pond-bank { padding: 10px; border: 1px solid #a8b09a; border-radius: 30px; background: #b5bda3; box-shadow: 0 6px 0 #738061; }
.pond-ready .pond-bank { outline: 3px solid #f8e7a0; outline-offset: 2px; }
.pond-water { border: 2px solid #3e7e7c; border-radius: 19px 26px 20px 25px; background: linear-gradient(155deg, #79c4bd 0%, #4fa9ae 34%, #338b9c 75%, #3c97a0 100%); box-shadow: inset 0 5px 9px #255b654d, inset 0 -3px 5px #d2f1c84d; }
.pond-empty .pond-water { filter: saturate(.65); }
.water-light { background: repeating-linear-gradient(165deg, transparent 0 32px, #e1fff910 33px 35px, transparent 36px 56px); }
.water-ripples i { position: absolute; width: 45px; height: 9px; border: 1px solid #d8ffff40; border-radius: 50%; }
.water-ripples i:nth-child(1) { left: 24%; top: 43%; }
.water-ripples i:nth-child(2) { left: 65%; top: 73%; width: 30px; }
.water-ripples i:nth-child(3) { left: 55%; top: 20%; width: 22px; }
.species-plaque { border: 1px solid #eefbfa70; border-radius: 6px; padding: 3px 7px; background: #f7fff0e6; color: #2c6057; font-size: 11px; box-shadow: 0 2px 4px #2a5d5b15; }
.ready-plaque { border-radius: 5px; padding: 3px 6px; background: #fff0af; font-size: 9px; color: #846315; }
.empty-plaque { color: #e4fff4; text-shadow: 0 1px 2px #205b63; }
.bank-grass { position: absolute; z-index: 2; width: 18px; height: 21px; background: #688c48; clip-path: polygon(0 100%, 2% 20%, 34% 70%, 39% 0, 62% 72%, 95% 17%, 100% 100%); }
.bank-grass-left { bottom: 5px; left: -7px; transform: rotate(-18deg); }
.bank-grass-right { top: -9px; right: 18px; transform: rotate(9deg); }
.lily-pad { position: absolute; width: 19px; height: 12px; border: 1px solid #548a5c; border-radius: 50%; background: #83b971; clip-path: polygon(0 0, 100% 0, 100% 100%, 46% 100%, 53% 52%, 27% 100%, 0 100%); }
.lily-one { left: 9px; bottom: 14px; transform: rotate(-25deg); }
.lily-two { left: 23px; bottom: 7px; width: 13px; height: 9px; transform: rotate(42deg); background: #a7c67b; }
.pond-dock { position: absolute; z-index: 3; left: 50%; bottom: -11px; width: 36px; height: 23px; transform: translateX(-50%) rotate(-3deg); border: 2px solid #98774d; border-radius: 2px; background: repeating-linear-gradient(0deg, #c6a573 0 5px, #9d7e52 5px 6px); box-shadow: 1px 2px 2px #294b452e; }
.pond-summary { box-shadow: 0 2px 4px #47633b0a; }
.swimming-area { container-type: inline-size; }
.fish { left: 0; width: var(--fish-width); mix-blend-mode: multiply; opacity: .9; animation-name: swim; animation-timing-function: linear; animation-iteration-count: infinite; will-change: transform; }
.fish-image { display: block; width: 100%; height: auto; pointer-events: none; user-select: none; }
.aerator-ring { position: absolute; right: -5px; bottom: -6px; width: 30px; height: 11px; border: 1px solid #e7ffffa6; border-radius: 50%; animation: aerator-ripple 2s ease-out infinite; }
.pond-effect { animation: feedback 2.4s ease-out both; }
.harvest-effect { color: #92400e; background: #fef3c7; }
.feeding-fish { animation: feeding .45s ease-in-out 4; }
.pellet { top: 5%; animation: food-fall 1.5s ease-in both; }
.simulation-paused, .simulation-paused * { animation-play-state: paused !important; }
@keyframes swim { 0% { transform: translateX(0) scaleX(-1); } 49% { transform: translateX(calc(100cqw - var(--fish-width))) scaleX(-1); } 50% { transform: translateX(calc(100cqw - var(--fish-width))) scaleX(1); } 100% { transform: translateX(0) scaleX(1); } }
@keyframes aerator-ripple { from { transform: scale(.4); opacity: .8; } to { transform: scale(1.8); opacity: 0; } }
@keyframes feedback { 0% { opacity: 0; transform: translateY(8px) scale(.9); } 15%, 80% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-12px); } }
@keyframes feeding { 50% { transform: translateY(-4px); } }
@keyframes food-fall { 0% { opacity: 0; transform: translateY(-15px); } 20% { opacity: 1; } 100% { opacity: 0; top: 70%; } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
</style>
