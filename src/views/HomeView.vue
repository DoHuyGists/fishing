<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/* ============ 1. NỘI DUNG – chỉ cần sửa phần này ============ */
interface Slide {
  src: string // URL ảnh thật; để '' sẽ dùng ảnh giữ chỗ
  title: string
  caption: string
}
interface Item {
  title: string
  desc: string
}
interface Fish {
  name: string
  place: string
  found: boolean // false = hiển thị như loài chưa khám phá
}

const game = {
  name: 'Tên Game Của Bạn', // TODO: thay tên game
  tagline: 'Thả câu, khám phá, và đi xa hơn sau mỗi lần cá cắn.',
  intro:
    'Trò chơi câu cá kết hợp khám phá và phát triển hành trình. Bạn chuẩn bị dụng cụ, ' +
    'chọn vùng nước, chinh phục những loài cá mới, rồi dùng thành quả để mở rộng khả năng ' +
    'và tiếp tục đi xa hơn. Qua mỗi lần thả câu, bạn sẽ thấy niềm vui của sự kiên nhẫn, ' +
    'tính tò mò, và cảm giác luôn có điều mới đang chờ được khám phá.',
  playUrl: '/play',
  trailerUrl: '#',
}

const slides: Slide[] = [
  { src: '', title: 'Chuẩn bị dụng cụ', caption: 'Chọn cần, mồi và phao phù hợp với nơi bạn sắp đến.' },
  { src: '', title: 'Thả câu', caption: 'Kiên nhẫn chờ phao chìm, rồi kéo đúng lúc.' },
  { src: '', title: 'Vùng nước mới', caption: 'Mỗi vùng nước có loài cá, thời tiết và nhịp sống riêng.' },
  { src: '', title: 'Bộ sưu tập', caption: 'Ghi lại từng loài cá bạn đã chinh phục.' },
]

const journey: Item[] = [
  { title: 'Chuẩn bị dụng cụ', desc: 'Chọn cần câu, mồi và phụ kiện hợp với vùng nước định đến.' },
  { title: 'Chọn vùng nước', desc: 'Ao yên, suối đá hay biển sâu. Mỗi nơi có cá và cách câu khác nhau.' },
  { title: 'Chinh phục loài cá mới', desc: 'Thả câu, chờ đúng nhịp và kéo cá lên để mở khóa vào bộ sưu tập.' },
  { title: 'Mở rộng và đi xa hơn', desc: 'Dùng thành quả để nâng cấp dụng cụ và mở những vùng nước chưa ai đến.' },
]

const values: Item[] = [
  { title: 'Kiên nhẫn', desc: 'Không vội vã. Cá sẽ cắn khi bạn chờ đủ lâu và đủ khéo.' },
  { title: 'Tò mò', desc: 'Đổi mồi, đổi chỗ, đổi giờ để xem điều gì xảy ra.' },
  { title: 'Luôn có điều mới', desc: 'Mỗi chuyến đi đều có thể gặp một loài cá bạn chưa từng thấy.' },
]

const fishes: Fish[] = [
  { name: 'Cá chép đồng', place: 'Ao làng', found: true },
  { name: 'Cá lăng suối', place: 'Suối đá', found: true },
  { name: 'Cá ngừ vây vàng', place: 'Biển khơi', found: true },
  { name: 'Chưa khám phá', place: 'Vùng nước chưa mở', found: false },
  { name: 'Chưa khám phá', place: 'Vùng nước chưa mở', found: false },
  { name: 'Chưa khám phá', place: 'Vùng nước chưa mở', found: false },
]

/* ============ 2. TRÌNH CHIẾU ============ */
const AUTOPLAY_MS = 5000
const current = ref(0)
const paused = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const waters = ['#1d5c63', '#2f6b4f', '#2a4f73', '#3b6a68']

// Ảnh giữ chỗ (mặt nước + phao câu) khi chưa có ảnh thật
function placeholder(i: number, label: string): string {
  const c = waters[i % waters.length]
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='#f4c9a0'/><stop offset='.42' stop-color='#a9c7c2'/>` +
    `<stop offset='.43' stop-color='${c}'/><stop offset='1' stop-color='#0c2325'/></linearGradient></defs>` +
    `<rect width='1600' height='900' fill='url(#g)'/>` +
    `<g stroke='#ffffff' stroke-opacity='.18' stroke-width='3' fill='none'>` +
    `<path d='M0 520q100-20 200 0t200 0t200 0t200 0t200 0t200 0t200 0t200 0'/>` +
    `<path d='M0 600q100-20 200 0t200 0t200 0t200 0t200 0t200 0t200 0t200 0'/></g>` +
    `<circle cx='1060' cy='640' r='26' fill='#e8553d'/><rect x='1034' y='640' width='52' height='26' fill='#f5efe6'/>` +
    `<text x='80' y='830' font-size='38' fill='#fff' opacity='.4' font-family='sans-serif'>${label}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const resolved = computed(() =>
  slides.map((s, i) => ({ ...s, src: s.src || placeholder(i, s.title) })),
)

const go = (i: number) => {
  current.value = (i + slides.length) % slides.length
}
const next = () => go(current.value + 1)
const prev = () => go(current.value - 1)

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

onMounted(() => {
  if (reduceMotion) return
  timer = setInterval(() => {
    if (!paused.value) next()
  }, AUTOPLAY_MS)
})
onBeforeUnmount(() => clearInterval(timer))

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') next()
  if (e.key === 'ArrowLeft') prev()
}
</script>

<template>
  <div class="min-h-screen bg-[#0c2325] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[#eef3ee]">
    <!-- Thanh điều hướng -->
    <header class="absolute inset-x-0 top-0 z-20">
      <nav class="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="/" class="font-['Bricolage_Grotesque',sans-serif] text-lg font-bold tracking-tight">
          {{ game.name }}
        </a>
        <div class="flex items-center gap-6 text-sm">
          <a href="#gioi-thieu" class="hidden hover:text-[#f4c9a0] sm:inline">Giới thiệu</a>
          <a href="#hanh-trinh" class="hidden hover:text-[#f4c9a0] sm:inline">Hành trình</a>
          <a href="#bo-suu-tap" class="hidden hover:text-[#f4c9a0] sm:inline">Bộ sưu tập</a>
          <a
            :href="game.playUrl"
            class="rounded-full bg-[#e8553d] px-4 py-2 font-semibold text-white transition hover:bg-[#f06a52] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Chơi ngay
          </a>
        </div>
      </nav>
    </header>

    <!-- Hero: trình chiếu hình ảnh -->
    <section
      class="relative h-[86vh] min-h-[540px] w-full overflow-hidden"
      tabindex="0"
      aria-roledescription="carousel"
      aria-label="Hình ảnh trong game"
      @mouseenter="paused = true"
      @mouseleave="paused = false"
      @focusin="paused = true"
      @focusout="paused = false"
      @keydown="onKey"
    >
      <img
        v-for="(s, i) in resolved"
        :key="i"
        :src="s.src"
        :alt="s.title"
        class="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 motion-reduce:transition-none"
        :class="i === current ? 'opacity-100' : 'opacity-0'"
        :aria-hidden="i !== current"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-[#0c2325] via-[#0c2325]/40 to-[#0c2325]/25" />

      <div class="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-28 sm:px-8">
        <h1
          class="max-w-3xl font-['Bricolage_Grotesque',sans-serif] text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl"
        >
          {{ game.name }}
        </h1>
        <p class="mt-4 max-w-xl text-lg text-[#eef3ee]/90 sm:text-xl">{{ game.tagline }}</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a
            :href="game.playUrl"
            class="rounded-full bg-[#e8553d] px-7 py-3 font-semibold text-white transition hover:bg-[#f06a52] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Thả câu ngay
          </a>
          <a
            :href="game.trailerUrl"
            class="rounded-full border border-white/50 px-7 py-3 font-semibold transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Xem trailer
          </a>
        </div>
      </div>

      <!-- Chú thích + điều khiển -->
      <div class="absolute inset-x-0 bottom-0 z-10 border-t border-white/10 bg-[#0c2325]/70 backdrop-blur">
        <div class="mx-auto flex max-w-7xl items-center gap-4 px-5 py-4 sm:px-8">
          <p class="min-w-0 flex-1 truncate text-sm text-[#eef3ee]/80" aria-live="polite">
            <span class="font-semibold text-white">{{ resolved[current].title }}.</span>
            {{ resolved[current].caption }}
          </p>

          <div class="hidden items-center gap-2 sm:flex">
            <button
              v-for="(s, i) in resolved"
              :key="i"
              type="button"
              class="h-11 w-20 overflow-hidden rounded-md border-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              :class="i === current ? 'border-[#e8553d]' : 'border-transparent opacity-60 hover:opacity-100'"
              :aria-label="`Xem ảnh ${i + 1}: ${s.title}`"
              :aria-current="i === current"
              @click="go(i)"
            >
              <img :src="s.src" alt="" class="h-full w-full object-cover" />
            </button>
          </div>

          <div class="flex gap-1">
            <button
              type="button"
              class="grid h-10 w-10 place-items-center rounded-full border border-white/30 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              aria-label="Ảnh trước"
              @click="prev"
            >
              ‹
            </button>
            <button
              type="button"
              class="grid h-10 w-10 place-items-center rounded-full border border-white/30 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              aria-label="Ảnh tiếp theo"
              @click="next"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Giới thiệu -->
    <section id="gioi-thieu" class="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <h2 class="font-['Bricolage_Grotesque',sans-serif] text-3xl font-bold tracking-tight sm:text-4xl">
          Mỗi lần thả câu là một chuyến đi nhỏ
        </h2>
        <p class="mt-5 max-w-prose text-lg leading-relaxed text-[#eef3ee]/80">{{ game.intro }}</p>
      </div>
      <ul class="divide-y divide-white/10 border-y border-white/10">
        <li v-for="v in values" :key="v.title" class="py-6">
          <h3 class="text-lg font-semibold text-[#f4c9a0]">{{ v.title }}</h3>
          <p class="mt-1 max-w-prose text-[#eef3ee]/75">{{ v.desc }}</p>
        </li>
      </ul>
    </section>

    <!-- Hành trình (một vòng lặp theo thứ tự nên có đánh số) -->
    <section id="hanh-trinh" class="bg-[#eef3ee] text-[#0c2325]">
      <div class="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <h2 class="font-['Bricolage_Grotesque',sans-serif] text-3xl font-bold tracking-tight sm:text-4xl">
          Hành trình của bạn
        </h2>
        <p class="mt-3 max-w-prose text-[#0c2325]/70">
          Xong bước cuối, bạn lại quay về bước đầu với đồ nghề tốt hơn và vùng nước mới.
        </p>
        <ol class="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <li v-for="(s, i) in journey" :key="s.title">
            <span
              class="grid h-9 w-9 place-items-center rounded-full bg-[#e8553d] font-bold text-white"
              aria-hidden="true"
            >
              {{ i + 1 }}
            </span>
            <h3 class="mt-4 text-lg font-semibold">{{ s.title }}</h3>
            <p class="mt-1 text-[#0c2325]/75">{{ s.desc }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Bộ sưu tập cá -->
    <section id="bo-suu-tap" class="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <h2 class="font-['Bricolage_Grotesque',sans-serif] text-3xl font-bold tracking-tight sm:text-4xl">
        Còn rất nhiều loài đang chờ bạn
      </h2>
      <p class="mt-3 max-w-prose text-[#eef3ee]/75">
        Mỗi loài cá bạn bắt được sẽ được ghi vào sổ. Những ô trống là điều bạn chưa gặp.
      </p>

      <ul class="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <li
          v-for="(f, i) in fishes"
          :key="i"
          class="rounded-xl border p-4"
          :class="f.found ? 'border-white/20 bg-white/5' : 'border-dashed border-white/15'"
        >
          <svg
            viewBox="0 0 100 50"
            class="h-16 w-full"
            :class="f.found ? 'text-[#f4c9a0]' : 'text-white/15'"
            fill="currentColor"
            aria-hidden="true"
          >
            <ellipse cx="42" cy="25" rx="32" ry="16" />
            <path d="M70 25 L96 8 L90 25 L96 42 Z" />
            <circle cx="22" cy="21" r="3" fill="#0c2325" />
          </svg>
          <p class="mt-3 text-sm font-semibold" :class="f.found ? '' : 'text-white/40'">
            {{ f.found ? f.name : '???' }}
          </p>
          <p class="text-xs text-[#eef3ee]/50">{{ f.place }}</p>
        </li>
      </ul>
    </section>

    <!-- Kêu gọi hành động -->
    <section class="bg-[#12363a]">
      <div class="mx-auto max-w-7xl px-5 py-24 text-center sm:px-8">
        <h2 class="font-['Bricolage_Grotesque',sans-serif] text-4xl font-extrabold tracking-tight sm:text-5xl">
          Phao đang nổi. Cá chưa cắn.
        </h2>
        <p class="mt-3 text-[#eef3ee]/75">Vào chơi ngay trên trình duyệt, không cần cài đặt.</p>
        <a
          :href="game.playUrl"
          class="mt-8 inline-block rounded-full bg-[#e8553d] px-9 py-4 font-semibold text-white transition hover:bg-[#f06a52] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Thả câu ngay
        </a>
      </div>
    </section>

    <footer class="border-t border-white/10 px-5 py-8 text-center text-sm text-[#eef3ee]/50">
      © {{ new Date().getFullYear() }} {{ game.name }}
    </footer>
  </div>
</template>