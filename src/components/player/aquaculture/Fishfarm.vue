<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useFishfarmStore, oxygenOf, statusOf, growthRateOf, canFeed, type Pond, type PondStatus } from '../../../stores/fishfarm'

const farm = useFishfarmStore()
const { ponds, totalFish, alertCount, readyCount } = storeToRefs(farm)

interface Point {
  x: number // %
  y: number // %
}

/* ---------- Bố cục (đơn vị %) ---------- */
const COL_X = [8, 37, 66]
const POND_W = 26
const ROW_Y = [5, 53]
const POND_H = 33
const LANE_Y = [45.5, 93] // vị trí chân nhân vật trên mỗi hành lang ngang
const GAP_X = [35.5, 64.5] // hành lang dọc giữa các cột hồ
const SPEED = 240 // px / giây

/* ---------- Chỉ số tính toán ---------- */
const statusLabel: Record<PondStatus, string> = { ok: 'Ổn định', warn: 'Cần theo dõi', alert: 'Cần xử lý' }
const statusChip: Record<PondStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-800',
  alert: 'bg-red-100 text-red-800',
}
const statusDot: Record<PondStatus, string> = { ok: 'bg-emerald-500', warn: 'bg-amber-500', alert: 'bg-red-500' }
const progressOf = (p: Pond) => !p.fishCount ? 'Hồ trống' : p.growth >= 100 ? 'Sẵn sàng thu hoạch' : p.fullness <= 0 ? 'Cá đói · Ngừng lớn' : p.fullness < 30 ? 'Cá đói · Lớn chậm' : 'Đang lớn'
const feedLabel = (p: Pond) => p.feedCooldown > 0 ? `Đợi ${Math.ceil(p.feedCooldown / farm.speed)} giây` : p.fullness > 65 ? 'Cá còn no' : 'Cho ăn · +35 độ no'

let simulationTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  let previous = performance.now()
  simulationTimer = setInterval(() => {
    const current = performance.now()
    if (!document.hidden) farm.tick((current - previous) / 1000)
    previous = current
  }, 250)
})

/* ---------- Nhân vật ---------- */
const farmRef = ref<HTMLElement | null>(null)
const pos = ref<Point>({ x: GAP_X[0], y: LANE_Y[0] })
const facing = ref<1 | -1>(1)
const walking = ref(false)
const activeId = ref<number | null>(null) // hồ đang mở bảng
const targetId = ref<number | null>(null) // hồ nhân vật đang đi tới

const activePond = computed(() => ponds.value.find((p) => p.id === activeId.value) ?? null)

const standPoint = (p: Pond): Point => ({ x: COL_X[p.col] + POND_W / 2, y: LANE_Y[p.row] })

let animationFrame: number | null = null
let cancelStep: (() => void) | null = null

function stepTo(to: Point): Promise<boolean> {
  const from = { ...pos.value }
  if (to.x === from.x && to.y === from.y) return Promise.resolve(true)
  if (to.x !== from.x) facing.value = to.x > from.x ? 1 : -1

  return new Promise((resolve) => {
    let progress = 0
    let previousTime: number | null = null
    cancelStep = () => resolve(false)

    const advance = (time: number) => {
      const el = farmRef.value
      if (!el) {
        animationFrame = null
        cancelStep = null
        resolve(false)
        return
      }

      // Đo lại mỗi khung hình để giữ tốc độ khi đổi kích thước màn hình.
      const distance = Math.hypot(
        ((to.x - from.x) / 100) * el.clientWidth,
        ((to.y - from.y) / 100) * el.clientHeight,
      )
      const elapsed = previousTime === null ? 0 : Math.min(time - previousTime, 64)
      previousTime = time
      progress = distance < 1 ? 1 : Math.min(1, progress + (SPEED * elapsed) / (1000 * distance))
      pos.value = {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(advance)
      } else {
        animationFrame = null
        cancelStep = null
        resolve(true)
      }
    }

    animationFrame = requestAnimationFrame(advance)
  })
}

onBeforeUnmount(() => {
  if (simulationTimer !== null) clearInterval(simulationTimer)
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  cancelStep?.()
})

function buildRoute(to: Point): Point[] {
  const from = pos.value
  if (Math.abs(from.y - to.y) < 0.5) return [to]
  const gap = GAP_X.reduce((a, b) => (Math.abs(b - from.x) < Math.abs(a - from.x) ? b : a))
  return [
    { x: gap, y: from.y },
    { x: gap, y: to.y },
    to,
  ]
}

async function goToPond(p: Pond) {
  if (walking.value) return
  activeId.value = null
  targetId.value = p.id
  walking.value = true
  for (const point of buildRoute(standPoint(p))) {
    if (!(await stepTo(point))) return
  }
  facing.value = 1
  walking.value = false
  activeId.value = p.id
}

/* ---------- Thao tác ---------- */
function closePanel() {
  activeId.value = null
  targetId.value = null
}

/* ---------- Cá bơi (trang trí) ---------- */
const fishes = Array.from({ length: 6 }, (_, i) => ({
  top: 12 + ((i * 29) % 68),
  duration: 7 + ((i * 3) % 6),
  delay: -(i * 2.3),
}))

</script>

<template>
  <div class="flex min-h-full w-full flex-col overflow-hidden rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a] md:h-full md:min-h-[32rem]">
    <!-- Thanh trên -->
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#cbd9c6] bg-[#f5f9f0] px-4 py-3">
      <h1 class="text-base font-semibold">Nông trại thủy sản</h1>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span>Số hồ: <b>{{ ponds.length }}</b></span>
        <span>Tổng cá: <b>{{ totalFish.toLocaleString('vi-VN') }}</b> con</span>
        <span>Chờ thu: <b>{{ readyCount }}</b></span>
        <span>Xu thử: <b>{{ farm.demoCoins.toLocaleString('vi-VN') }}</b></span>
        <span :class="alertCount ? 'text-red-700' : 'text-emerald-700'">
          Cảnh báo: <b>{{ alertCount }}</b>
        </span>
      </div>
    </header>

    <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#cbd9c6] px-4 py-2 text-xs">
      <p class="max-w-xl">Bản chơi thử cục bộ · Đủ no + đủ oxy: khoảng 60 giây/lứa. Cho ăn → cá lớn → thu hoạch → thả lại. Tải lại trang sẽ bắt đầu lại.</p>
      <div class="flex gap-2">
        <button type="button" class="rounded border border-[#cbd9c6] px-3 py-1.5 hover:bg-white" :aria-pressed="farm.paused" @click="farm.togglePause()">{{ farm.paused ? 'Tiếp tục' : 'Tạm dừng' }}</button>
        <button type="button" class="rounded border border-[#cbd9c6] px-3 py-1.5 hover:bg-white" :aria-label="`Tốc độ hiện tại ${farm.speed} lần. Nhấn để đổi tốc độ`" @click="farm.toggleSpeed()">Tốc độ ×{{ farm.speed }}</button>
      </div>
      <p class="w-full text-stone-600">{{ farm.paused ? 'Đang tạm dừng.' : 'Chỉ chạy khi đang xem nông trại.' }} Đã thu {{ farm.harvestedBatches }} lứa · {{ farm.harvestedKg.toLocaleString('vi-VN') }} kg.</p>
      <p class="sr-only" role="status" aria-live="polite">{{ farm.announcement }}</p>
    </div>

    <div class="flex min-h-0 flex-1 flex-col md:flex-row">
      <!-- Khu nông trại -->
      <main ref="farmRef" class="relative h-96 min-h-[24rem] min-w-0 shrink-0 overflow-hidden bg-[#a8c985] md:h-auto md:flex-1" :aria-busy="walking">
        <!-- Lối đi -->
        <div class="absolute inset-x-0 bg-[#dccfa8]" :style="{ top: '38%', height: '15%' }" />
        <div class="absolute inset-x-0 bg-[#dccfa8]" :style="{ top: '86%', height: '14%' }" />
        <div
          v-for="gx in GAP_X"
          :key="gx"
          class="absolute inset-y-0 bg-[#dccfa8]"
          :style="{ left: gx - 1.5 + '%', width: '3%' }"
        />

        <!-- Các hồ -->
        <button
          v-for="p in ponds"
          :key="p.id"
          type="button"
          class="absolute cursor-pointer border-8 border-[#8c9196] bg-[#3f8fbd] p-0 text-left outline-offset-2 hover:outline hover:outline-2 hover:outline-white"
          :class="{ 'outline outline-2 outline-white': targetId === p.id, 'pond-ready': p.fishCount > 0 && p.growth >= 100, 'simulation-paused': farm.paused }"
          :style="{
            left: COL_X[p.col] + '%',
            top: ROW_Y[p.row] + '%',
            width: POND_W + '%',
            height: POND_H + '%',
          }"
          :aria-label="`Chọn ${p.name}: ${progressOf(p)}, tăng trưởng ${Math.floor(p.growth)}%, độ no ${Math.ceil(p.fullness)}%`"
          :disabled="walking"
          @click="goToPond(p)"
        >
          <div class="relative h-full w-full overflow-hidden">
            <!-- Cá -->
            <div v-if="p.fishCount" class="absolute inset-x-2 inset-y-0" :class="{ 'feeding-fish': p.effect?.kind === 'feed' }">
              <span
                v-for="(f, i) in fishes"
                :key="i"
                class="fish absolute block"
                :style="{
                  width: (12 + p.growth * 0.16) + 'px',
                  height: (6 + p.growth * 0.08) + 'px',
                  top: f.top + '%',
                  backgroundColor: p.fishColor,
                  animationDuration: f.duration + 's',
                  animationDelay: f.delay + 's',
                }"
              />
            </div>
            <!-- Nhãn hồ -->
            <div class="absolute left-0 top-0 flex max-w-full items-start gap-1 bg-white/90 px-1 py-1 text-[10px] font-medium text-stone-800 sm:gap-2 sm:px-2 sm:text-xs">
              <span class="mt-0.5 h-2 w-2 shrink-0" :class="statusDot[statusOf(p)]" />
              <span class="min-w-0 break-words">{{ p.name }} · {{ p.species }}</span>
            </div>
            <div v-if="p.aerator" class="pointer-events-none absolute bottom-6 right-2" aria-hidden="true">
              <span v-for="n in 3" :key="n" class="bubble absolute h-2 w-2 rounded-full border border-white/80" :style="{ right: n * 5 + 'px', animationDelay: n * 0.4 + 's' }" />
            </div>
            <div v-if="p.effect?.kind === 'feed'" :key="`food-${p.effect.id}`" class="pointer-events-none absolute inset-0" aria-hidden="true">
              <span v-for="n in 8" :key="n" class="pellet absolute h-1.5 w-1.5 rounded-full bg-amber-300" :style="{ left: (15 + n * 8) + '%', animationDelay: n * 0.07 + 's' }" />
            </div>
            <div v-if="p.effect" :key="p.effect.id" class="pond-effect pointer-events-none absolute inset-x-0 top-1/3 z-10 bg-white/95 px-1 py-2 text-center text-[10px] font-bold text-emerald-800 sm:text-xs" :class="{ 'harvest-effect': p.effect.kind === 'harvest' }">
              {{ p.effect.text }}
            </div>
            <div class="absolute inset-x-0 bottom-0 bg-white/95 px-1 py-1 text-[9px] sm:text-[11px]">
              <span>{{ progressOf(p) }}<template v-if="p.fishCount && p.growth < 100"> · {{ Math.floor(p.growth) }}%</template></span>
              <div v-if="p.fishCount" class="mt-0.5 h-1 overflow-hidden rounded bg-stone-200"><div class="meter-fill h-full bg-emerald-600" :style="{ width: p.growth + '%' }" /></div>
            </div>
          </div>
        </button>

        <!-- Nhân vật -->
        <div
          class="pointer-events-none absolute z-10"
          :style="{
            left: pos.x + '%',
            top: pos.y + '%',
            transform: 'translate(-50%, -100%)',
          }"
        >
          <div class="relative h-14 w-9" :class="{ walking }" :style="{ transform: `scaleX(${facing})` }">
            <div class="absolute left-1 top-0 h-2 w-7 bg-yellow-400" />
            <div class="absolute left-2 top-2 h-5 w-5 bg-[#f1c7a0]">
              <span class="absolute right-1 top-2 h-1 w-1 bg-stone-800" />
            </div>
            <div class="body absolute left-1 top-7 h-6 w-7 bg-[#e07a2f]" />
            <div class="leg leg-a absolute left-2 top-[52px] h-1 w-2 bg-[#2f4858]" />
            <div class="leg leg-b absolute left-5 top-[52px] h-1 w-2 bg-[#2f4858]" />
          </div>
        </div>

        <!-- Gợi ý -->
        <div
          v-if="!activePond && !walking"
          class="absolute bottom-3 left-3 bg-white px-3 py-1.5 text-sm text-stone-700"
        >
          Nhấn vào một hồ để nhân vật đi tới.
        </div>
        <div v-if="walking" class="absolute bottom-3 left-3 bg-white px-3 py-1.5 text-sm text-stone-700">
          Đang di chuyển…
        </div>
      </main>

      <!-- Bảng tương tác -->
      <aside v-if="activePond" class="flex min-h-0 w-full shrink-0 flex-col border-t border-[#cbd9c6] bg-white md:w-80 md:border-t-0 md:border-l">
        <div class="flex shrink-0 items-start justify-between border-b border-stone-200 p-4">
          <div>
            <h2 class="text-lg font-semibold">{{ activePond.name }}</h2>
            <p class="text-sm text-stone-600">{{ activePond.species }}</p>
          </div>
          <button class="px-2 text-xl leading-none text-stone-500 hover:text-stone-900" aria-label="Đóng" @click="closePanel">
            ×
          </button>
        </div>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <span class="inline-block px-2 py-1 text-xs font-medium" :class="statusChip[statusOf(activePond)]">
            {{ statusLabel[statusOf(activePond)] }}
          </span>

          <div class="space-y-3 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3">
            <p class="text-sm font-semibold">Lứa {{ activePond.cycle }} · {{ progressOf(activePond) }}</p>
            <template v-if="activePond.fishCount">
              <div v-for="meter in [{ label: 'Độ no', value: activePond.fullness }, { label: 'Tăng trưởng', value: activePond.growth }]" :key="meter.label">
                <div class="mb-1 flex justify-between text-xs"><span>{{ meter.label }}</span><b>{{ Math.floor(meter.value) }}%</b></div>
                <div class="h-2 overflow-hidden rounded-full bg-stone-200" role="progressbar" :aria-label="meter.label" :aria-valuenow="Math.floor(meter.value)" :aria-valuemin="0" :aria-valuemax="100">
                  <div class="meter-fill h-full rounded-full" :class="meter.label === 'Độ no' && meter.value < 30 ? 'bg-amber-500' : 'bg-emerald-600'" :style="{ width: meter.value + '%' }" />
                </div>
              </div>
              <p class="text-xs text-stone-600">Độ no giảm 1 điểm/giây mô phỏng. Dưới 30: lớn chậm; về 0: ngừng lớn. Cá đủ lớn sẽ chờ bạn thu hoạch.</p>
              <p v-if="oxygenOf(activePond) < 5" class="text-xs font-medium text-amber-800">Thiếu oxy làm cá lớn chậm. Bật sục khí để cải thiện.</p>
            </template>
            <p v-else class="text-xs">Hồ đã thu hoạch. Thả cá miễn phí để bắt đầu lứa mới.</p>
          </div>

          <div v-if="farm.lastHarvest?.pondName === activePond.name" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Lần thu gần nhất: {{ farm.lastHarvest.fishCount.toLocaleString('vi-VN') }} con · {{ farm.lastHarvest.kg.toLocaleString('vi-VN') }} kg · +{{ farm.lastHarvest.coins.toLocaleString('vi-VN') }} xu thử.
          </div>

          <dl class="grid grid-cols-2 gap-px bg-stone-200 text-sm">
            <div class="bg-white p-2">
              <dt class="text-xs text-stone-500">Số lượng</dt>
              <dd class="font-medium">{{ activePond.fishCount.toLocaleString('vi-VN') }} con</dd>
            </div>
            <div class="bg-white p-2">
              <dt class="text-xs text-stone-500">Trọng lượng TB</dt>
              <dd class="font-medium">{{ activePond.fishCount ? activePond.avgWeightG + ' g' : '—' }}</dd>
            </div>
            <div class="bg-white p-2">
              <dt class="text-xs text-stone-500">Nhiệt độ</dt>
              <dd class="font-medium">{{ activePond.tempC }} °C</dd>
            </div>
            <div class="bg-white p-2">
              <dt class="text-xs text-stone-500">pH</dt>
              <dd class="font-medium">{{ activePond.ph }}</dd>
            </div>
            <div class="bg-white p-2">
              <dt class="text-xs text-stone-500">Oxy hòa tan</dt>
              <dd class="font-medium">{{ oxygenOf(activePond) }} mg/L</dd>
            </div>
            <div class="bg-white p-2">
              <dt class="text-xs text-stone-500">Thu hoạch sau (ước tính)</dt>
              <dd class="font-medium">{{ !activePond.fishCount ? 'Chưa thả cá' : activePond.growth >= 100 ? 'Ngay bây giờ' : growthRateOf(activePond) === 0 ? 'Cần cho ăn' : `~${Math.ceil((100 - activePond.growth) / growthRateOf(activePond) / farm.speed)} giây` }}</dd>
            </div>
            <div class="bg-white p-2">
              <dt class="text-xs text-stone-500">Cho ăn lần cuối</dt>
              <dd class="font-medium">{{ activePond.lastFed }}</dd>
            </div>
            <div class="bg-white p-2">
              <dt class="text-xs text-stone-500">Máy sục khí</dt>
              <dd class="font-medium">{{ activePond.aerator ? 'Đang bật' : 'Đang tắt' }}</dd>
            </div>
          </dl>
        </div>

        <div class="grid shrink-0 gap-2 border-t border-stone-200 p-4">
          <button v-if="activePond.fishCount && activePond.growth < 100" class="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50" :disabled="farm.paused || !canFeed(activePond)" @click="farm.feed(activePond.id)">
            {{ feedLabel(activePond) }}
          </button>
          <button v-if="activePond.fishCount" class="rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50" :disabled="farm.paused || activePond.growth < 100" @click="farm.harvest(activePond.id)">{{ activePond.growth >= 100 ? 'Thu hoạch · Nhận xu thử' : 'Cá đang lớn · Chưa thể thu' }}</button>
          <button v-else class="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50" :disabled="farm.paused" @click="farm.restock(activePond.id)">Thả lứa mới · Miễn phí</button>
          <button
            class="border border-stone-400 px-3 py-2 text-sm font-medium hover:bg-stone-100"
            @click="farm.toggleAerator(activePond.id)"
          >
            {{ activePond.aerator ? 'Tắt sục khí' : 'Bật sục khí' }}
          </button>
        </div>
      </aside>
      <aside v-else class="hidden w-80 shrink-0 items-center justify-center border-l border-[#cbd9c6] bg-white p-6 text-center text-sm text-stone-600 md:flex">
        {{ walking ? 'Nhân vật đang đi tới hồ đã chọn…' : 'Chọn một hồ để xem thông tin và chăm sóc cá.' }}
      </aside>
    </div>
  </div>
</template>

<style scoped>
.meter-fill { transition: width 0.25s linear; }
.pond-ready { border-color: #d5a535; animation: ready-glow 1.6s ease-in-out infinite; }
.pond-effect { animation: feedback 2.4s ease-out both; }
.harvest-effect { color: #92400e; background: #fef3c7; }
.feeding-fish { animation: feeding 0.45s ease-in-out 4; }
.pellet { top: 5%; animation: food-fall 1.5s ease-in both; }
.bubble { animation: bubble-rise 1.8s ease-out infinite; }
.simulation-paused *, .simulation-paused { animation-play-state: paused !important; }

@keyframes ready-glow {
  50% { box-shadow: 0 0 0 4px #fef08a, 0 0 18px #facc15; }
}
@keyframes feedback {
  0% { opacity: 0; transform: translateY(12px) scale(0.9); }
  15%, 80% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-12px); }
}
@keyframes feeding {
  50% { transform: translateY(-4px); }
}
@keyframes food-fall {
  0% { opacity: 0; transform: translateY(-15px); }
  20% { opacity: 1; }
  100% { opacity: 0; top: 70%; }
}
@keyframes bubble-rise {
  0% { opacity: 0; transform: translateY(0) scale(0.5); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-45px) scale(1.3); }
}

.fish {
  clip-path: polygon(0 50%, 25% 15%, 70% 15%, 100% 0, 100% 100%, 70% 85%, 25% 85%);
  animation-name: swim;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes swim {
  0% { left: 0; transform: scaleX(1); }
  49% { left: calc(100% - 20px); transform: scaleX(1); }
  50% { left: calc(100% - 20px); transform: scaleX(-1); }
  99% { left: 0; transform: scaleX(-1); }
  100% { left: 0; transform: scaleX(1); }
}

.walking .body { animation: bob 0.3s steps(2) infinite; }
.walking .leg-a { animation: step-a 0.3s steps(2) infinite; }
.walking .leg-b { animation: step-b 0.3s steps(2) infinite; }

@keyframes bob {
  50% { transform: translateY(-2px); }
}
@keyframes step-a {
  0% { height: 4px; }
  50% { height: 2px; transform: translateY(-2px); }
}
@keyframes step-b {
  0% { height: 2px; transform: translateY(-2px); }
  50% { height: 4px; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
</style>
