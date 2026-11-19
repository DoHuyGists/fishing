<script lang="ts" setup>
import type { BookVariant, BookProps } from "../../../types/model/diary";
import { computed, nextTick, onBeforeUnmount, onBeforeUpdate, ref, useSlots } from 'vue'

/** Một trang nội dung bên trong sách */
interface BookPage {
  title?: string
  content?: string
}

/** Trang nội bộ: lấy từ prop `pages` hoặc từ named slot `page-N` */
type PageItem = BookPage & { slot?: string }

const props = withDefaults(defineProps<BookProps & { pages?: BookPage[] }>(), {
  title: '1984',
  author: 'George Orwell',
  numUp: '84',
  numDown: '1',
  variant: 'default',
  scale: 1,
})

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'close'): void
}>()

const VARIANT_PRESETS: Record<BookVariant, { coverBg: string; spineBg: string; textColor: string }> = {
  default: {
    coverBg: 'linear-gradient(45deg, #DAD5DC 0%, #f2ebf4 100%)',
    spineBg: 'rgba(232, 229, 234, 1)',
    textColor: '#2b2b2b',
  },
  ocean: {
    coverBg: 'linear-gradient(45deg, #102a43 0%, #243b53 50%, #334e68 100%)',
    spineBg: '#091e36',
    textColor: '#f0f4f8',
  },
  gold: {
    coverBg: 'linear-gradient(45deg, #785208 0%, #f7c948 100%)',
    spineBg: '#5c3d02',
    textColor: '#1f1601',
  },
  dark: {
    coverBg: 'linear-gradient(45deg, #18181b 0%, #3f3f46 100%)',
    spineBg: '#09090b',
    textColor: '#f4f4f5',
  },
  emerald: {
    coverBg: 'linear-gradient(45deg, #064e3b 0%, #10b981 100%)',
    spineBg: '#022c22',
    textColor: '#ecfdf5',
  },
}

const styleVars = computed(() => {
  const preset = VARIANT_PRESETS[props.variant] || VARIANT_PRESETS.default
  return {
    '--book-cover-bg': props.coverBg || preset.coverBg,
    '--book-spine-bg': props.spineBg || preset.spineBg,
    '--book-text-color': props.textColor || preset.textColor,
    '--book-scale': props.scale,
  }
})

/* ------------------------------------------------------------------ */
/*  Nội dung trang                                                     */
/* ------------------------------------------------------------------ */

// Đọc các slot dạng `page-1`, `page-2`, ... (chỉ đọc tên slot, không render)
const slots = useSlots()
const readSlotPageNumbers = () =>
  Object.keys(slots)
    .map((k) => /^page-(\d+)$/.exec(k)?.[1])
    .filter((n): n is string => !!n)
    .map(Number)
const slotPageMax = ref(Math.max(0, ...readSlotPageNumbers()))
onBeforeUpdate(() => {
  const max = Math.max(0, ...readSlotPageNumbers())
  if (max !== slotPageMax.value) slotPageMax.value = max
})

const pageList = computed<PageItem[]>(() => {
  // 1. Ưu tiên slot: <template #page-1>, <template #page-2>, ...
  if (slotPageMax.value > 0) {
    return Array.from({ length: slotPageMax.value }, (_, i) => ({ slot: `page-${i + 1}` }))
  }
  // 2. Prop `pages`
  if (props.pages?.length) return props.pages
  // Nội dung mẫu khi chưa truyền prop `pages`
  return [
    {
      title: props.title,
      content: `${props.author}\n\nTruyền prop "pages" để hiển thị nội dung của bạn vào đây.`,
    },
    {
      title: 'Trang thứ hai',
      content:
        'Mỗi trang gồm một tiêu đề và một đoạn nội dung. Nếu nội dung dài hơn khung trang, bạn có thể cuộn ngay trong trang.',
    },
    {
      title: 'Lật trang',
      content:
        'Dùng hai nút bên dưới hoặc phím mũi tên trái/phải để lật trang. Nhấn Esc hoặc nhấn ra ngoài để đóng sách.',
    },
    {
      title: 'Tuỳ biến',
      content:
        'Dùng slot "page" để tự render nội dung từng trang, và slot "inner-cover" để thay hình bìa trong bên trái.',
    },
  ]
})

/** Gom các trang thành từng tờ giấy: mặt trước (trang phải) + mặt sau (trang trái) */
const contentLeaves = computed(() => {
  const list = pageList.value
  const leaves: { sides: { cls: string; page: PageItem | null; no: number }[] }[] = []
  for (let k = 0; k < list.length; k += 2) {
    leaves.push({
      sides: [
        { cls: 'face-front', page: list[k], no: k + 1 },
        { cls: 'face-back', page: list[k + 1] ?? null, no: k + 2 },
      ],
    })
  }
  return leaves
})

/** Tổng số tờ = bìa trước + các tờ nội dung */
const totalLeaves = computed(() => contentLeaves.value.length + 1)

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const MOVE_MS = 750 // bay ra giữa + phóng to
const FLIP_MS = 900 // lật một tờ

const slotEl = ref<HTMLElement | null>(null)
const moverEl = ref<HTMLElement | null>(null)
const anchorEl = ref<HTMLElement | null>(null)
const bookEl = ref<HTMLElement | null>(null)
const backdropEl = ref<HTMLElement | null>(null)

const isOpen = ref(false) // sách đang ở giữa màn hình
const flipped = ref(0) // số tờ đã lật sang trái (>=1 nghĩa là bìa đã mở)
const busy = ref(false)
const controlsVisible = ref(false)
const openScale = ref(1)
const slotMinHeight = ref(0)
const movingLeaves = ref<number[]>([])
const leafDelays = ref<Record<number, number>>({})
const bookDelay = ref(0)

let moveTimer: ReturnType<typeof setTimeout> | undefined
let prevBodyOverflow = ''
let prevBodyPadding = ''

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------------ */
/*  Style bindings                                                     */
/* ------------------------------------------------------------------ */

const slotStyle = computed(() =>
  isOpen.value && slotMinHeight.value ? { minHeight: `${slotMinHeight.value}px` } : undefined,
)

const moverStyle = computed(() =>
  isOpen.value ? { transform: `scale(${openScale.value})` } : undefined,
)

// Khi bìa mở, dịch cả quyển sách sang phải nửa bề rộng để gáy sách nằm đúng giữa màn hình
const bookStyle = computed(() => ({
  transform: flipped.value > 0 ? 'translateX(50%)' : undefined,
  transitionDelay: `${bookDelay.value}ms`,
}))

function leafStyle(i: number) {
  const isFlipped = i < flipped.value
  const isMoving = movingLeaves.value.includes(i)
  return {
    transform: `rotateY(${isFlipped ? -180 : 0}deg)`,
    // tờ đang lật luôn nằm trên cùng; tờ đã yên vị xếp theo thứ tự chồng sách
    zIndex: isMoving ? 100 + (totalLeaves.value - i) : isFlipped ? i : totalLeaves.value - i,
    transitionDelay: `${leafDelays.value[i] ?? 0}ms`,
  }
}

const spreadLabel = computed(() => {
  const f = flipped.value
  const leaves = contentLeaves.value.length
  const total = pageList.value.length
  const left = f >= 2 ? 2 * f - 2 : 0
  const right = f <= leaves ? 2 * f - 1 : 0
  const nums = [left, right].filter((n) => n > 0 && n <= total)
  return nums.length ? `Trang ${nums.join('–')} / ${total}` : ''
})

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function computeOpenScale() {
  const w = window.innerWidth
  const h = window.innerHeight
  // Cả hai trang (800px) phải lọt màn hình, chừa chỗ cho nút điều khiển bên dưới
  openScale.value = Math.max(0.3, Math.min((w * 0.9) / 800, (h * 0.78) / 550, 1.6))
}

function lockScroll() {
  const scrollbar = window.innerWidth - document.documentElement.clientWidth
  prevBodyOverflow = document.body.style.overflow
  prevBodyPadding = document.body.style.paddingRight
  document.body.style.overflow = 'hidden'
  if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
}

function unlockScroll() {
  document.body.style.overflow = prevBodyOverflow
  document.body.style.paddingRight = prevBodyPadding
}

function onResize() {
  computeOpenScale()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}

/** Lật tới trạng thái `target` (số tờ đã lật). `stagger` dùng khi lật nhiều tờ cùng lúc */
function flipTo(target: number, stagger = 0) {
  const from = flipped.value
  if (target === from) return

  const goingBack = target < from
  const lo = Math.min(from, target)
  const hi = Math.max(from, target)
  const changed: number[] = []
  const delays: Record<number, number> = {}
  for (let i = lo; i < hi; i++) {
    changed.push(i)
    delays[i] = (goingBack ? from - 1 - i : i - from) * stagger
  }

  movingLeaves.value = [...new Set([...movingLeaves.value, ...changed])]
  leafDelays.value = { ...leafDelays.value, ...delays }
  flipped.value = target

  clearTimeout(moveTimer)
  moveTimer = setTimeout(() => {
    movingLeaves.value = []
    leafDelays.value = {}
  }, FLIP_MS + Math.max(0, ...Object.values(delays)) + 60)
}

function next() {
  if (!isOpen.value || flipped.value < 1 || flipped.value >= totalLeaves.value) return
  flipTo(flipped.value + 1)
}

function prev() {
  if (!isOpen.value || flipped.value <= 1) return
  flipTo(flipped.value - 1)
}

/* ------------------------------------------------------------------ */
/*  Mở / đóng sách                                                     */
/* ------------------------------------------------------------------ */

async function open() {
  if (isOpen.value || busy.value) return
  const anchor = anchorEl.value
  const book = bookEl.value
  const slot = slotEl.value
  if (!anchor || !book || !slot) return
  busy.value = true

  // FIRST: ghi lại vị trí hiện tại và độ nghiêng do hover
  const first = anchor.getBoundingClientRect()
  const tilt = getComputedStyle(book).transform

  slotMinHeight.value = slot.offsetHeight // giữ chỗ để layout trang không bị nhảy
  computeOpenScale()
  lockScroll()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)

  // Teleport sách ra <body>, nằm giữa màn hình
  isOpen.value = true
  emit('open')
  await nextTick()

  const mover = moverEl.value
  if (!mover) {
    busy.value = false
    return
  }

  // LAST: vị trí đích ở giữa màn hình
  const last = anchor.getBoundingClientRect()
  const dx = first.left + first.width / 2 - (last.left + last.width / 2)
  const dy = first.top + first.height / 2 - (last.top + last.height / 2)

  // INVERT + PLAY: bay từ chỗ cũ ra giữa màn hình và phóng to
  const move = mover.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${props.scale})` },
      { transform: `scale(${openScale.value})` },
    ],
    { duration: MOVE_MS, easing: EASE },
  )
  book.animate([{ transform: tilt }, { transform: 'none' }], { duration: MOVE_MS, easing: EASE })
  backdropEl.value?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOVE_MS, easing: 'ease-out' })

  await move.finished.catch(() => {})

  // Mở bìa
  flipTo(1)
  await sleep(FLIP_MS)
  controlsVisible.value = true
  busy.value = false
}

async function close() {
  if (!isOpen.value || busy.value) return
  const mover = moverEl.value
  const slot = slotEl.value
  if (!mover || !slot) return
  busy.value = true
  controlsVisible.value = false

  // 1. Gấp các trang lại, rồi đóng bìa (lật lần lượt từ tờ trên cùng)
  const count = flipped.value
  const stagger = count > 1 ? Math.min(120, 700 / count) : 0
  bookDelay.value = Math.max(0, (count - 1) * stagger)
  flipTo(0, stagger)
  await sleep(FLIP_MS + bookDelay.value + 60)
  bookDelay.value = 0

  // 2. Bay về đúng chỗ cũ trong trang
  const slotRect = slot.getBoundingClientRect()
  const moverRect = mover.getBoundingClientRect()
  const dx = slotRect.left + slotRect.width / 2 - (moverRect.left + moverRect.width / 2)
  const dy = slotRect.top + slotRect.height / 2 - (moverRect.top + moverRect.height / 2)

  const back = mover.animate(
    [
      { transform: `scale(${openScale.value})` },
      { transform: `translate(${dx}px, ${dy}px) scale(${props.scale})` },
    ],
    { duration: MOVE_MS, easing: EASE, fill: 'forwards' },
  )
  backdropEl.value?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: MOVE_MS,
    easing: 'ease-in',
    fill: 'forwards',
  })
  await back.finished.catch(() => {})

  // 3. Đưa sách về lại vị trí gốc trong DOM
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  isOpen.value = false
  unlockScroll()
  await nextTick()
  back.cancel()
  busy.value = false
  emit('close')
}

onBeforeUnmount(() => {
  clearTimeout(moveTimer)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  if (isOpen.value) unlockScroll()
})

defineExpose({ open, close })
</script>

<template>
  <div ref="slotEl" class="book-slot" :style="slotStyle">
    <Teleport to="body" :disabled="!isOpen">
      <div
        class="book-stage"
        :class="{ 'is-open': isOpen, 'is-spread': flipped > 0 }"
        :style="styleVars"
      >
        <div v-if="isOpen" ref="backdropEl" class="book-backdrop" @click="close" />

        <div ref="moverEl" class="book-container" :style="moverStyle">
          <div ref="anchorEl" class="book-anchor">
            <div
              ref="bookEl"
              class="book"
              :style="bookStyle"
              :role="isOpen ? undefined : 'button'"
              :tabindex="isOpen ? -1 : 0"
              :aria-label="isOpen ? undefined : `Mở sách ${title}`"
              @click="open"
              @keydown.enter.prevent="open"
            >
              <div class="left-side">
                <div class="spine-title">
                  <span>{{ author }}</span>
                  <span>{{ title }}</span>
                </div>
              </div>

              <div class="leaves">
                <!-- Tờ 0: bìa trước (mặt ngoài) + bìa trong (mặt sau) -->
                <div class="leaf" :style="leafStyle(0)">
                  <div class="face face-front cover">
                    <div class="num-up">{{ numUp }}</div>
                    <slot name="cover-icon">
                      <svg
                        id="eye-left"
                        xmlns="http://www.w3.org/2000/svg"
                        width="75"
                        height="100"
                        version="1.0"
                      >
                        <path
                          d="m 72.520861,60.915859 v 0 C 69.385207,53.011396 61.908243,46.570093 55.74346,42.387465 49.578631,38.204905 40.408101,36.818968 33.679899,37.051071 c -1.597953,0.05517 -2.931531,0.451253 -4.000736,1.188245 -0.738155,0.570053 -1.097854,1.127016 -1.079089,1.670881 0.02949,0.854739 0.93486,2.69053 2.716108,5.507379 0.805175,1.372521 1.234574,2.83577 1.288193,4.389751 0.131362,3.807345 -0.983571,6.879734 -3.344801,9.217182 -2.361227,2.337476 -5.686459,3.580206 -9.975699,3.728183 C 15.162859,62.894893 11.580282,61.559887 8.5361375,58.747669 5.4920363,55.935482 3.8975877,52.431474 3.7527937,48.235627 c -0.1769131,-5.1282 2.0835359,-9.776522 6.7813483,-13.944986 4.697855,-4.168379 11.041643,-6.390426 19.031387,-6.666142 8.662566,-0.298838 16.811229,2.201105 24.446015,7.499833 7.634738,5.298806 13.804506,13.895976 18.509317,25.791527 z"
                          fill="currentColor"
                          fill-opacity="1"
                          stroke="none"
                          stroke-width=".72233355px"
                          stroke-linecap="butt"
                          stroke-linejoin="miter"
                          stroke-opacity="1"
                        />
                      </svg>
                      <svg
                        id="eye-right"
                        xmlns="http://www.w3.org/2000/svg"
                        width="75"
                        height="100"
                        version="1.0"
                      >
                        <path
                          d="m 72.520861,60.915859 v 0 C 69.385207,53.011396 61.908243,46.570093 55.74346,42.387465 49.578631,38.204905 40.408101,36.818968 33.679899,37.051071 c -1.597953,0.05517 -2.931531,0.451253 -4.000736,1.188245 -0.738155,0.570053 -1.097854,1.127016 -1.079089,1.670881 0.02949,0.854739 0.93486,2.69053 2.716108,5.507379 0.805175,1.372521 1.234574,2.83577 1.288193,4.389751 0.131362,3.807345 -0.983571,6.879734 -3.344801,9.217182 -2.361227,2.337476 -5.686459,3.580206 -9.975699,3.728183 C 15.162859,62.894893 11.580282,61.559887 8.5361375,58.747669 5.4920363,55.935482 3.8975877,52.431474 3.7527937,48.235627 c -0.1769131,-5.1282 2.0835359,-9.776522 6.7813483,-13.944986 4.697855,-4.168379 11.041643,-6.390426 19.031387,-6.666142 8.662566,-0.298838 16.811229,2.201105 24.446015,7.499833 7.634738,5.298806 13.804506,13.895976 18.509317,25.791527 z"
                          fill="currentColor"
                          fill-opacity="1"
                          stroke="none"
                          stroke-width=".72233355px"
                          stroke-linecap="butt"
                          stroke-linejoin="miter"
                          stroke-opacity="1"
                        />
                      </svg>
                    </slot>
                    <div class="num-down">{{ numDown }}</div>
                    <div class="author">{{ author }}</div>
                    <div class="title">{{ title }}</div>
                  </div>

                  <div class="face face-back endpaper">
                    <slot name="inner-cover">
                      <div class="endpaper-mark">
                        <span>{{ title }}</span>
                        <span>{{ author }}</span>
                      </div>
                    </slot>
                  </div>
                </div>

                <!-- Các tờ nội dung -->
                <div
                  v-for="(leaf, j) in contentLeaves"
                  :key="j"
                  class="leaf page-leaf"
                  :style="leafStyle(j + 1)"
                >
                  <div
                    v-for="side in leaf.sides"
                    :key="side.no"
                    class="face paper"
                    :class="side.cls"
                  >
                    <div v-if="side.page" class="page-body">
                      <slot v-if="side.page.slot" :name="side.page.slot" :number="side.no" />
                      <slot v-else name="page" :page="side.page" :number="side.no">
                        <h3 v-if="side.page.title" class="page-title">{{ side.page.title }}</h3>
                        <p v-if="side.page.content" class="page-text">{{ side.page.content }}</p>
                      </slot>
                    </div>
                    <span v-if="side.page" class="page-number">{{ side.no }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Transition name="book-fade">
          <div v-if="isOpen && controlsVisible" class="book-controls">
            <button type="button" class="ctl ctl-close" aria-label="Đóng sách" @click.stop="close">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>

            <div class="ctl-pager">
              <button
                type="button"
                class="ctl"
                aria-label="Trang trước"
                :disabled="flipped <= 1"
                @click.stop="prev"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <span class="ctl-label">{{ spreadLabel }}</span>
              <button
                type="button"
                class="ctl"
                aria-label="Trang sau"
                :disabled="flipped >= totalLeaves"
                @click.stop="next"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ---------- Khung giữ chỗ trong trang ---------- */
.book-slot {
  display: flow-root;
}

/* ---------- Sân khấu: inline khi đóng, toàn màn hình khi mở ---------- */
.book-stage.is-open {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.book-backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(24, 22, 28, 0.78) 0%, rgba(4, 4, 6, 0.94) 100%);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* Lớp này chịu trách nhiệm di chuyển + phóng to */
.book-container {
  position: relative;
  z-index: 1;
  transform: scale(var(--book-scale, 1));
  transform-origin: center center;
}

.book-stage.is-open .book-container {
  flex: none;
}

.book-anchor {
  perspective: 3000px;
  width: 400px;
  height: 550px;
  margin: 5% auto;
}

.book-stage.is-open .book-anchor {
  margin: 0;
}

/* ---------- Quyển sách ---------- */
.book {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 2px 4px 4px 2px;
  background: var(--book-cover-bg);
  font-family: acumin-pro, sans-serif;
  box-shadow: 13px 13px 8px 0px rgba(0, 0, 0, 0.3);
  font-weight: 400;
  color: var(--book-text-color);
  transform-style: preserve-3d;
  transition: transform 0.5s;
}

.book-stage:not(.is-open) .book {
  cursor: pointer;
}

.book-stage:not(.is-open) .book:hover,
.book-stage:not(.is-open) .book:focus-visible {
  transform: rotate3d(0, 1, 0, 35deg);
}

.book-stage:not(.is-open) .book:focus-visible {
  outline: 2px solid var(--book-text-color);
  outline-offset: 6px;
}

.book-stage.is-open .book {
  transition: transform 0.9s cubic-bezier(0.645, 0.045, 0.355, 1);
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.5);
}

/* ---------- Gáy sách ---------- */
.left-side {
  position: absolute;
  display: block;
  width: 40px;
  left: -20px;
  height: 550px;
  background-color: var(--book-spine-bg);
  transform: rotate3d(0, 1, 0, -90deg);
  transition: opacity 0.3s;
}

.book-stage.is-spread .left-side {
  opacity: 0;
}

.spine-title {
  width: 500px;
  height: 40px;
  color: var(--book-text-color);
  font-size: 15px;
  line-height: 40px;
  padding-right: 10px;
  text-align: right;
  transform-origin: 0 0;
  transform: rotate(90deg) translateY(-40px);
}

.left-side .spine-title span:first-child {
  font-weight: 400;
  font-size: 13px;
  padding-right: 20px;
  color: white;
}

.left-side .spine-title span:last-child {
  font-family: acumin-pro, sans-serif;
  color: white;
}

/* ---------- Chồng các tờ giấy ---------- */
.leaves {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* transform-style để mặc định (flat) để z-index sắp xếp các tờ giấy */
  transform: translateZ(20px);
  perspective: 2600px;
  perspective-origin: 0% 50%;
  transition: filter 0.6s;
}

.book-stage.is-spread .leaves {
  filter: drop-shadow(-4px 14px 18px rgba(0, 0, 0, 0.32));
}

.leaf {
  position: absolute;
  top: 0;
  left: 0;
  width: 400px;
  height: 550px;
  transform-origin: 0% 50%;
  transform-style: preserve-3d;
  transition: transform 0.9s cubic-bezier(0.645, 0.045, 0.355, 1);
}

/* Ruột sách nhỏ hơn bìa một chút để lộ viền bìa */
.leaf.page-leaf {
  top: 6px;
  width: 390px;
  height: 538px;
}

.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.face-back {
  transform: rotateY(180deg);
}

/* ---------- Bìa trước ---------- */
.cover {
  background: var(--book-cover-bg);
  border-radius: 0 3px 3px 0;
  box-shadow: inset 4px 0 10px rgba(0, 0, 0, 0.1);
}

.cover:after {
  content: '';
  position: absolute;
  top: 0;
  left: 10px;
  bottom: 0;
  width: 3px;
  background: rgba(0, 0, 0, 0.1);
  box-shadow: 1px 0 3px rgba(255, 255, 255, 0.1);
}

.cover svg {
  position: absolute;
  top: 50%;
  left: 45%;
  margin-top: -100px;
  margin-left: -110px;
  width: 300px;
  color: var(--book-text-color);
}

#eye-right {
  padding-left: 185px;
}

.cover .num-up {
  position: absolute;
  top: 64px;
  left: 47px;
  letter-spacing: 5px;
  transform: rotate(-90deg);
  color: var(--book-text-color);
}

.cover .num-down {
  position: absolute;
  top: 125px;
  left: 38px;
  transform: rotate(-90deg);
  color: var(--book-text-color);
}

.author {
  font-family: acumin-pro, sans-serif;
  font-weight: 400;
  position: absolute;
  top: 475px;
  left: 50px;
  opacity: 0.8;
  color: var(--book-text-color);
}

.title {
  font-family: acumin-pro, sans-serif;
  font-weight: 400;
  position: absolute;
  top: 495px;
  left: 50px;
  opacity: 0.8;
  color: var(--book-text-color);
}

/* ---------- Bìa trong (bên trái khi vừa mở) ---------- */
.endpaper {
  border-radius: 3px 0 0 3px;
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.045) 0 6px, transparent 6px 12px),
    var(--book-spine-bg);
  box-shadow: inset -8px 0 14px rgba(0, 0, 0, 0.28);
  color: var(--book-text-color);
}

.endpaper-mark {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  letter-spacing: 3px;
  opacity: 0.7;
  text-align: center;
}

/* ---------- Trang giấy ---------- */
.paper {
  color: #342f29;
  font-family: Georgia, 'Times New Roman', serif;
}

.paper.face-front {
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.16) 0%, rgba(0, 0, 0, 0) 9%),
    #f6f4ef;
  border-radius: 0 3px 3px 0;
}

.paper.face-back {
  background:
    linear-gradient(270deg, rgba(0, 0, 0, 0.16) 0%, rgba(0, 0, 0, 0) 9%),
    #f6f4ef;
  border-radius: 3px 0 0 3px;
}

.page-body {
  position: absolute;
  top: 40px;
  bottom: 56px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

/* chừa lề gáy rộng hơn lề ngoài */
.face-front .page-body {
  left: 46px;
  right: 34px;
}

.face-back .page-body {
  left: 34px;
  right: 46px;
}

.page-title {
  margin: 0 0 18px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.01em;
}

.page-text {
  margin: 0;
  font-size: 15.5px;
  line-height: 1.8;
  white-space: pre-line;
  hyphens: auto;
}

/* Nội dung tự viết trong slot thừa hưởng kiểu chữ của trang */
.page-body :deep(img) {
  max-width: 100%;
  height: auto;
}

.page-number {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 12px;
  opacity: 0.5;
}

/* ---------- Điều khiển ---------- */
.book-controls {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.ctl {
  pointer-events: auto;
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #f4f4f5;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: background 0.2s, opacity 0.2s;
}

.ctl:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.22);
}

.ctl:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.ctl:disabled {
  opacity: 0.3;
  cursor: default;
}

.ctl-close {
  position: absolute;
  top: calc(20px + env(safe-area-inset-top, 0px));
  right: 20px;
}

.ctl-pager {
  position: absolute;
  bottom: calc(22px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  display: flex;
  align-items: center;
  gap: 14px;
  transform: translateX(-50%);
}

.ctl-label {
  min-width: 110px;
  text-align: center;
  font: 13px/1 acumin-pro, system-ui, sans-serif;
  color: rgba(244, 244, 245, 0.85);
  pointer-events: none;
}

.book-fade-enter-active,
.book-fade-leave-active {
  transition: opacity 0.35s;
}

.book-fade-enter-from,
.book-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .leaf,
  .book-stage.is-open .book {
    transition-duration: 0.01s;
  }
}
</style>