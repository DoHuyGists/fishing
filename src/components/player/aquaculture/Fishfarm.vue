<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useFishfarmStore, oxygenOf, growthRateOf, canFeed } from '../../../stores/fishfarm'
import FishPond from './FishPond.vue'
import { progressOf } from './pondPresentation'

const farm = useFishfarmStore()
const { pond } = storeToRefs(farm)
const feedLabel = computed(() => pond.value.feedCooldown > 0
  ? `Đợi ${Math.ceil(pond.value.feedCooldown / farm.speed)} giây`
  : pond.value.fullness > 65 ? 'Cá còn no' : 'Cho ăn · +35 độ no')

let simulationTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  let previous = performance.now()
  simulationTimer = setInterval(() => {
    const current = performance.now()
    if (!document.hidden && (!farm.paused || pond.value.effect)) {
      farm.tick((current - previous) / 1000)
    }
    previous = current
  }, 1000)
})

onBeforeUnmount(() => {
  if (simulationTimer !== null) clearInterval(simulationTimer)
})
</script>

<template>
  <div class="fishfarm flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a]">
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#cbd9c6] px-4 py-3">
      <span class="inline-flex items-center gap-2 text-sm font-semibold">
        <span class="h-2 w-2 rounded-full" :class="farm.paused ? 'bg-stone-400' : 'bg-emerald-500'" />
        {{ farm.paused ? 'Đã tạm dừng' : 'Ao cá đang phát triển' }}
      </span>
      <div class="flex gap-2">
        <button type="button" class="control-button" :aria-pressed="farm.paused" @click="farm.togglePause()">
          {{ farm.paused ? 'Tiếp tục' : 'Tạm dừng' }}
        </button>
        <button type="button" class="control-button" :aria-label="`Tốc độ hiện tại ${farm.speed} lần. Nhấn để đổi tốc độ`" @click="farm.toggleSpeed()">
          Tốc độ ×{{ farm.speed }}
        </button>
      </div>
    </header>

    <div class="farm-workspace min-h-0 flex-1">
      <main class="pond-area" aria-label="Ao nuôi cá">
        <FishPond :pond="pond" :paused="farm.paused" />
      </main>

      <aside class="care-panel" aria-label="Chăm sóc ao cá">
        <div class="border-b border-[#cbd9c6] p-4">
          <p class="m-0 text-xs font-bold uppercase tracking-wider text-emerald-700">Chăm sóc ao cá</p>
          <h2 class="mb-0 mt-2 text-lg font-semibold">{{ pond.name }} · {{ pond.species }}</h2>
        </div>
        <div class="care-body space-y-4 p-4">
          <div class="space-y-3 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3">
            <p class="m-0 text-xs font-bold">Lứa {{ pond.cycle }} <span class="mx-1 text-stone-400">/</span> {{ progressOf(pond) }}</p>
            <template v-if="pond.fishCount">
              <div v-for="meter in [{ label: 'Độ no', value: pond.fullness }, { label: 'Tăng trưởng', value: pond.growth }]" :key="meter.label"><div class="mb-1.5 flex justify-between text-[11px]"><span>{{ meter.label }}</span><b>{{ Math.floor(meter.value) }}%</b></div><div class="h-2 overflow-hidden rounded-full bg-[#dfe8d8]" role="progressbar" :aria-label="meter.label" :aria-valuenow="Math.floor(meter.value)" :aria-valuemin="0" :aria-valuemax="100"><div class="meter-fill h-full rounded-full" :class="meter.label === 'Độ no' && meter.value < 30 ? 'bg-amber-500' : 'bg-emerald-600'" :style="{ width: meter.value + '%' }" /></div></div>
              <p class="m-0 text-[11px] leading-relaxed text-stone-600">Độ no giảm 1 điểm/giây mô phỏng. Dưới 30: lớn chậm; về 0: ngừng lớn. Cá đủ lớn sẽ chờ bạn thu hoạch.</p><p v-if="oxygenOf(pond) < 5" class="m-0 rounded-lg bg-amber-100/70 p-2 text-[11px] font-medium text-amber-900">Thiếu oxy làm cá lớn chậm. Bật sục khí để cải thiện.</p>
            </template>
            <p v-else class="m-0 text-xs">Hồ đã thu hoạch. Thả cá miễn phí để bắt đầu lứa mới.</p>
          </div>
          <div v-if="farm.lastHarvest?.pondName === pond.name" class="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Lần thu gần nhất: {{ farm.lastHarvest.fishCount.toLocaleString('vi-VN') }} con · {{ farm.lastHarvest.kg.toLocaleString('vi-VN') }} kg · +{{ farm.lastHarvest.coins.toLocaleString('vi-VN') }} xu thử.</div>
          <div><h3 class="mb-2 mt-0 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">Thông tin ao nuôi</h3>
            <dl class="pond-details grid grid-cols-2 gap-2 text-xs">
              <div><dt>Số lượng</dt><dd>{{ pond.fishCount.toLocaleString('vi-VN') }} con</dd></div><div><dt>Trọng lượng TB</dt><dd>{{ pond.fishCount ? pond.avgWeightG + ' g' : '—' }}</dd></div>
              <div><dt>Nhiệt độ</dt><dd>{{ pond.tempC }} °C</dd></div><div><dt>pH</dt><dd>{{ pond.ph }}</dd></div>
              <div><dt>Oxy hòa tan</dt><dd :class="oxygenOf(pond) < 5 ? 'text-amber-700' : 'text-emerald-700'">{{ oxygenOf(pond) }} mg/L</dd></div><div><dt>Thu hoạch sau</dt><dd>{{ !pond.fishCount ? 'Chưa thả cá' : pond.growth >= 100 ? 'Ngay bây giờ' : growthRateOf(pond) === 0 ? 'Cần cho ăn' : `~${Math.ceil((100 - pond.growth) / growthRateOf(pond) / farm.speed)} giây` }}</dd></div>
              <div><dt>Cho ăn lần cuối</dt><dd>{{ pond.lastFed }}</dd></div><div><dt>Máy sục khí</dt><dd>{{ pond.aerator ? 'Đang bật' : 'Đang tắt' }}</dd></div>
            </dl>
          </div>
        </div>
        <div class="care-actions grid shrink-0 gap-2 border-t border-[#cbd9c6] bg-white p-4">
          <button v-if="pond.fishCount && pond.growth < 100" type="button" class="care-action bg-emerald-700 text-white hover:bg-emerald-800" :disabled="farm.paused || !canFeed(pond)" @click="farm.feed()">{{ feedLabel }}</button>
          <button v-if="pond.fishCount" type="button" class="care-action bg-amber-200 text-amber-950 hover:bg-amber-300" :disabled="farm.paused || pond.growth < 100" @click="farm.harvest()">{{ pond.growth >= 100 ? 'Thu hoạch · Nhận xu thử' : 'Cá đang lớn · Chưa thể thu' }}</button>
          <button v-else type="button" class="care-action bg-emerald-700 text-white hover:bg-emerald-800" :disabled="farm.paused" @click="farm.restock()">Thả lứa mới · Miễn phí</button>
          <button type="button" class="care-action border border-[#cbd9c6] bg-[#f5f9f0] hover:bg-[#e8f0e0]" :aria-pressed="pond.aerator" @click="farm.toggleAerator()">{{ pond.aerator ? 'Tắt sục khí' : 'Bật sục khí' }}</button>
        </div>
      </aside>
    </div>

    <footer class="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[#cbd9c6] px-4 py-2 text-[11px] text-stone-500">
      <span>Bản chơi thử cục bộ · Tải lại trang sẽ bắt đầu lại.</span>
      <span class="font-semibold text-emerald-800">{{ farm.demoCoins.toLocaleString('vi-VN') }} xu thử · Đã thu {{ farm.harvestedBatches }} lứa / {{ farm.harvestedKg.toLocaleString('vi-VN') }} kg</span>
      <p class="sr-only" role="status" aria-live="polite">{{ farm.announcement }}</p>
    </footer>
  </div>
</template>

<style scoped>
.farm-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 340px; overflow-y: auto; }
.pond-area { display: flex; min-width: 0; min-height: 420px; padding: 24px; background: #dce8cd; }
.care-panel { display: flex; min-height: 0; flex-direction: column; border-left: 1px solid #cbd9c6; background: #fbfcf8; }
.care-body { min-height: 0; flex: 1; overflow-y: auto; }
.control-button { border: 1px solid #cbd9c6; border-radius: 8px; padding: 8px 12px; background: white; font-size: 12px; }
.control-button:hover { background: #e8f0e0; }
button:focus-visible { outline: 2px solid #347552; outline-offset: 3px; }
.pond-details > div { border: 1px solid #e1e8da; border-radius: 9px; padding: 9px; background: white; }
.pond-details dt { margin-bottom: 5px; font-size: 11px; color: #7b8275; }
.pond-details dd { font-size: 12px; font-weight: 600; }
.care-action { border-radius: 9px; padding: 10px 12px; font-size: 12px; font-weight: 600; }
.care-action:disabled { cursor: not-allowed; opacity: .5; }
@media (max-width: 899px) {
  .farm-workspace { display: block; }
  .pond-area { height: clamp(380px, 50vh, 560px); min-height: 380px; padding: 16px; }
  .care-panel { border-top: 1px solid #cbd9c6; border-left: 0; }
  .care-body { order: 2; overflow-y: visible; }
  .care-actions { order: 1; }
}
</style>
