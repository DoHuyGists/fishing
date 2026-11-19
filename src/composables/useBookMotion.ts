import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import type { ComputedRef } from "vue";

export function useBookMotion(scale: () => number, totalLeaves: ComputedRef<number>, emit: (event: "open" | "close") => void) {
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

let disposed = false
const waits = new Map<ReturnType<typeof setTimeout>, () => void>()
let moveTimer: ReturnType<typeof setTimeout> | undefined
let prevBodyOverflow = ''
let prevBodyPadding = ''

const sleep = (ms: number) => new Promise<void>((resolve) => {
  const timer = setTimeout(() => { waits.delete(timer); resolve() }, ms)
  waits.set(timer, resolve)
})

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
  if (disposed || isOpen.value || busy.value) return
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
  if (disposed) return

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
      { transform: `translate(${dx}px, ${dy}px) scale(${scale()})` },
      { transform: `scale(${openScale.value})` },
    ],
    { duration: MOVE_MS, easing: EASE },
  )
  book.animate([{ transform: tilt }, { transform: 'none' }], { duration: MOVE_MS, easing: EASE })
  backdropEl.value?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOVE_MS, easing: 'ease-out' })

  await move.finished.catch(() => {})
  if (disposed) return

  // Mở bìa
  flipTo(1)
  await sleep(FLIP_MS)
  if (disposed) return
  controlsVisible.value = true
  busy.value = false
}

async function close() {
  if (disposed || !isOpen.value || busy.value) return
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
  if (disposed) return
  bookDelay.value = 0

  // 2. Bay về đúng chỗ cũ trong trang
  const slotRect = slot.getBoundingClientRect()
  const moverRect = mover.getBoundingClientRect()
  const dx = slotRect.left + slotRect.width / 2 - (moverRect.left + moverRect.width / 2)
  const dy = slotRect.top + slotRect.height / 2 - (moverRect.top + moverRect.height / 2)

  const back = mover.animate(
    [
      { transform: `scale(${openScale.value})` },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale()})` },
    ],
    { duration: MOVE_MS, easing: EASE, fill: 'forwards' },
  )
  backdropEl.value?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: MOVE_MS,
    easing: 'ease-in',
    fill: 'forwards',
  })
  await back.finished.catch(() => {})
  if (disposed) return

  // 3. Đưa sách về lại vị trí gốc trong DOM
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  isOpen.value = false
  unlockScroll()
  await nextTick()
  if (disposed) return
  back.cancel()
  busy.value = false
  emit('close')
}

onBeforeUnmount(() => {
  disposed = true
  for (const [timer, resolve] of waits) { clearTimeout(timer); resolve() }
  waits.clear()
  for (const el of [moverEl.value, bookEl.value, backdropEl.value]) {
    for (const animation of el?.getAnimations() ?? []) animation.cancel()
  }
  clearTimeout(moveTimer)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  if (isOpen.value) unlockScroll()
})


return { slotEl, moverEl, anchorEl, bookEl, backdropEl, isOpen, flipped, controlsVisible, slotStyle, moverStyle, bookStyle, leafStyle, open, close, next, prev };
}
