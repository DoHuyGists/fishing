<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Props {
  /** Ảnh PNG nền trong suốt, đầu cá quay sang TRÁI */
  src: string
  /** Chiều rộng hiển thị của cá (px) */
  size?: number
  /** Tốc độ bơi trung bình (px/giây) */
  speed?: number
  /** Biên độ vẫy đuôi, tính theo tỷ lệ chiều cao thân cá */
  tailAmp?: number
  /** Nhịp vẫy đuôi (rad/giây). Nhỏ hơn = thong thả hơn */
  waveSpeed?: number
  /** Số chu kỳ sóng dọc thân cá (nhỏ = thân uốn ít) */
  wavelength?: number
  /** Mức lượn lên xuống, tính theo tỷ lệ chiều cao khung (0 = bơi thẳng) */
  wander?: number
  /** Số lát cắt để uốn thân; nhiều hơn = mượt hơn */
  slices?: number
  paused?: boolean
  initialX?: number
  lane?: number
  phaseOffset?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 180,
  speed: 26,
  tailAmp: 0.1,
  waveSpeed: 3.2,
  wavelength: 0.8,
  wander: 0.18,
  slices: 15,
  paused: false,
  initialX: 0.7,
  lane: 0.5,
  phaseOffset: 0,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const decorationRef = ref<HTMLDivElement | null>(null)

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let ro: ResizeObserver | null = null
let sprite: HTMLCanvasElement | null = null // ảnh đã co về đúng kích thước hiển thị
let spriteW = 0
let spriteH = 0
let dpr = 1
let W = 0
let H = 0
let last = 0
let phase = 0
let elapsed = 0

// Trạng thái bơi
let x = 0
let y = 0
let dir = -1 // -1: bơi sang trái (hướng gốc của ảnh), 1: sang phải
let flip = 1 // 1 = giữ nguyên, -1 = lật ngang; đổi dần để cá quay đầu
let tilt = 0
let prevY = 0
let started = false

const reduceMotion =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v))
}

function buildSprite(img: HTMLImageElement) {
  const aspect = img.naturalHeight / img.naturalWidth
  const size = Math.max(1, Math.min(props.size, Math.max(1, W - 32), Math.max(1, H - 16) / (aspect * 1.5)))
  const w = Math.max(1, Math.round(size * dpr))
  const h = Math.round((img.naturalHeight / img.naturalWidth) * w)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) return
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, 0, 0, w, h)
  sprite = c
  spriteW = w
  spriteH = h
}

let image: HTMLImageElement | null = null
function loadImage() {
  sprite = null
  image = null
  if (!props.src) return
  const el = new Image()
  const src = props.src
  el.onload = () => {
    if (props.src !== src) return
    image = el
    buildSprite(el)
  }
  el.onerror = () => console.warn('[FishSwim] Không tải được ảnh:', props.src)
  el.src = props.src
}

function resize() {
  const cv = canvasRef.value
  const parent = cv?.parentElement
  if (!cv || !parent) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = parent.clientWidth
  H = parent.clientHeight
  cv.width = Math.round(W * dpr)
  cv.height = Math.round(H * dpr)
  ctx = cv.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (image) buildSprite(image)
  if (!started && W > 0) {
    x = W * clamp(props.initialX, 0, 1)
    y = H * clamp(props.lane, 0, 1)
    prevY = y
    started = true
  }
}

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  const dt = props.paused || reduceMotion ? 0 : Math.min((now - last) / 1000, 0.05)
  last = now
  if (!ctx) return
  if (!sprite) {
    ctx.clearRect(0, 0, W, H)
    return
  }
  elapsed += dt
  const time = elapsed + props.phaseOffset
  const dw = spriteW / dpr // kích thước hiển thị (px CSS)
  const dh = spriteH / dpr
  const motion = reduceMotion ? 0 : 1

  // --- Di chuyển: lúc lướt nhanh, lúc chậm lại cho thong thả ---
  const glide = 0.75 + 0.25 * Math.sin(time * 0.8)
  const turning = Math.abs(flip) < 0.999 ? Math.abs(flip) : 1
  x += dir * props.speed * glide * turning * dt * motion

  const margin = Math.min(W / 2, dw / 2 + 16)
  x = clamp(x, margin, W - margin)
  if (dir < 0 && x <= margin) dir = 1
  else if (dir > 0 && x >= W - margin) dir = -1

  // Quay đầu mượt: flip trượt dần về đích (1 khi bơi trái, -1 khi bơi phải)
  const targetFlip = dir < 0 ? 1 : -1
  const step = dt * 1.6
  flip += clamp(targetFlip - flip, -step, step)

  // Lượn lên xuống nhẹ nhàng
  const yBase =
    H * clamp(props.lane, 0, 1) +
    props.wander * H * (0.6 * Math.sin(time * 0.31) + 0.4 * Math.sin(time * 0.17 + 2)) * motion
  const verticalMargin = Math.min(H / 2, dh * (0.5 + props.tailAmp) + 4)
  y = clamp(yBase, verticalMargin, H - verticalMargin)
  const vy = dt > 0 ? (y - prevY) / dt : 0
  prevY = y

  // Nghiêng đầu theo hướng lên/xuống
  const wantTilt = clamp((-vy * flip) / Math.max(props.speed, 1), -0.35, 0.35) * 0.5
  tilt += (wantTilt - tilt) * Math.min(1, dt * 3)

  // Nhịp vẫy đuôi nhanh hơn một chút khi đang lướt nhanh
  phase += dt * props.waveSpeed * (0.8 + 0.4 * glide) * motion

  ctx.clearRect(0, 0, W, H)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.scale(flip, 1)

  // --- Uốn thân: cắt ảnh thành nhiều lát dọc, mỗi lát lệch lên/xuống theo sóng ---
  const n = props.slices
  const sliceSrcW = spriteW / n
  const sliceDstW = dw / n
  const ampPx = props.tailAmp * dh * motion
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n // 0 = đầu (trái ảnh), 1 = đuôi (phải ảnh)
    const envelope = 0.06 + 0.94 * u * u // đầu gần như đứng yên, đuôi vẫy mạnh
    const off = ampPx * envelope * Math.sin(u * props.wavelength * Math.PI * 2 - phase)
    ctx.drawImage(
      sprite,
      i * sliceSrcW,
      0,
      sliceSrcW + 1,
      spriteH,
      -dw / 2 + i * sliceDstW,
      -dh / 2 + off,
      sliceDstW + 0.8, // chồng nhẹ để không hở khe giữa các lát
      dh,
    )
  }
  ctx.restore()

  const decoration = decorationRef.value
  if (decoration) {
    decoration.style.width = `${dw}px`
    decoration.style.height = `${dh}px`
    decoration.style.transform = `translate(${x - dw / 2}px, ${y - dh / 2}px) rotate(${tilt}rad)`
    decoration.style.visibility = 'visible'
  }
}

onMounted(() => {
  resize()
  loadImage()
  const parent = canvasRef.value?.parentElement
  if (parent) {
    ro = new ResizeObserver(resize)
    ro.observe(parent)
  }
  last = performance.now()
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
})

watch(() => props.src, loadImage)
watch(
  () => props.size,
  () => image && buildSprite(image),
)
</script>

<template>
  <div class="fish-swim">
    <canvas ref="canvasRef" />
    <div v-if="$slots.default" ref="decorationRef" class="fish-decoration"><slot /></div>
  </div>
</template>

<style scoped>
.fish-swim {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.fish-decoration {
  position: absolute;
  top: 0;
  left: 0;
  visibility: hidden;
}
.fish-swim canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  pointer-events: none;
}
</style>
