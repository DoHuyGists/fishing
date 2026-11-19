<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Props {
  /** Đường dẫn ảnh PNG thay cho phao mặc định (để trống = dùng phao vẽ sẵn) */
  src?: string
  /** Chiều rộng hiển thị của phao (px) */
  size?: number
  /** Vị trí mực nước trên ảnh, 0 = mép trên, 1 = mép dưới (chỉ dùng với src) */
  waterline?: number
  /** Màu vòng sóng */
  rippleColor?: string
  /** Chu kỳ tự tỏa sóng (giây). 0 = tắt */
  rippleInterval?: number
  /** Độ dẹt của sóng (góc nhìn): 1 = tròn, nhỏ hơn = dẹt hơn */
  squash?: number
  /** Cho phép chạm/click để thả sóng */
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  size: 48,
  waterline: 0.75,
  rippleColor: '#3b9bb0',
  rippleInterval: 1.6,
  squash: 0.32,
  clickable: true,
})

interface Ripple {
  x: number
  y: number
  t: number
  s: number
}

const canvasRef = ref<HTMLCanvasElement | null>(null)

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let ro: ResizeObserver | null = null
let img: HTMLImageElement | null = null
let W = 0
let H = 0
let kick = 0
let acc = 0
let last = 0
const ripples: Ripple[] = []
const reduceMotion =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

function loadImage(src: string) {
  if (!src) {
    img = null
    return
  }
  const el = new Image()
  el.onload = () => {
    img = el
  }
  el.onerror = () => {
    img = null
    console.warn('[FloatRipple] Không tải được ảnh:', src)
  }
  el.src = src
}

function resize() {
  const cv = canvasRef.value
  const parent = cv?.parentElement
  if (!cv || !parent) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = parent.clientWidth
  H = parent.clientHeight
  cv.width = Math.round(W * dpr)
  cv.height = Math.round(H * dpr)
  ctx = cv.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function addRipple(x: number, y: number, s = 1) {
  ripples.push({ x, y, t: 0, s })
}

function onPointerDown(e: PointerEvent) {
  if (!props.clickable || !canvasRef.value) return
  const r = canvasRef.value.getBoundingClientRect()
  addRipple(e.clientX - r.left, e.clientY - r.top, 1.2)
  kick = 1
}

function drawDefaultFloat(c: CanvasRenderingContext2D) {
  // Gốc toạ độ = mực nước, đơn vị: thân phao rộng ~30
  c.strokeStyle = 'rgba(120,120,120,0.6)'
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(0, -62)
  c.lineTo(0, -120)
  c.stroke()

  const bands: [string, number, number][] = [
    ['#f2f0ea', -62, -48],
    ['#e4452f', -48, -34],
    ['#f2f0ea', -34, -20],
    ['#e4452f', -20, -6],
  ]
  for (const [color, y0, y1] of bands) {
    c.fillStyle = color
    c.fillRect(-3, y0, 6, y1 - y0 + 0.5)
  }
  c.fillStyle = '#e4452f'
  c.beginPath()
  c.ellipse(0, 0, 15, 20, 0, Math.PI, 0)
  c.fill()
  c.fillStyle = '#f2f0ea'
  c.beginPath()
  c.ellipse(0, 0, 15, 10, 0, 0, Math.PI)
  c.fill()
  c.fillStyle = 'rgba(255,255,255,0.5)'
  c.beginPath()
  c.ellipse(-6, -8, 3, 6, -0.4, 0, Math.PI * 2)
  c.fill()
}

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  if (!ctx) return
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  const time = now / 1000
  const fx = W / 2
  const fy = H / 2
  const sq = props.squash

  ctx.clearRect(0, 0, W, H)

  // Tự tỏa sóng
  if (props.rippleInterval > 0) {
    acc += dt
    if (acc > props.rippleInterval) {
      acc = 0
      addRipple(fx, fy)
    }
  }

  // Chuyển động nhấp nhô
  kick = Math.max(0, kick - dt * 1.2)
  const m = reduceMotion ? 0 : 1
  const dip =
    (Math.sin(time * 2.1) * 7 + Math.sin(time * 0.9) * 4 + kick * Math.sin(time * 14) * 9) * m
  const tilt = (Math.sin(time * 1.3) * 0.08 + kick * Math.sin(time * 11) * 0.12) * m

  // Sóng lan
  ctx.lineCap = 'round'
  ctx.strokeStyle = props.rippleColor
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i]
    r.t += dt * (reduceMotion ? 0.5 : 1)
    const life = r.t / 3.2
    if (life >= 1) {
      ripples.splice(i, 1)
      continue
    }
    for (let k = 0; k < 3; k++) {
      const rr = (life * props.size * 3.8 - k * props.size * 0.4) * r.s
      if (rr <= 0) continue
      ctx.globalAlpha = Math.max((1 - life) * (0.8 - k * 0.2), 0)
      ctx.lineWidth = 2.4 - k * 0.6
      ctx.beginPath()
      ctx.ellipse(r.x, r.y, rr, rr * sq, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Gợn nhỏ sát chân phao, nhịp theo chuyển động
  const base = props.size / 30
  for (let k = 0; k < 2; k++) {
    const p = (time * 0.7 + k * 0.5) % 1
    const rr = (14 + p * 46) * base
    ctx.globalAlpha = 0.6 * (1 - p)
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.ellipse(fx, fy, rr, rr * sq, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Phao
  ctx.save()
  ctx.translate(fx, fy + dip * base)
  ctx.rotate(tilt)
  if (img) {
    const w = props.size
    const h = (img.naturalHeight / img.naturalWidth) * w
    ctx.drawImage(img, -w / 2, -h * props.waterline, w, h)
  } else {
    ctx.scale(base, base)
    drawDefaultFloat(ctx)
  }
  ctx.restore()

  // Vòng nước quanh chân phao
  ctx.strokeStyle = props.rippleColor
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 2
  const wr = (props.src && img ? props.size * 0.5 : 19 * base) + Math.sin(time * 2.1) * 1.5 * m
  ctx.beginPath()
  ctx.ellipse(fx, fy + dip * base * 0.35, wr, wr * sq, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
}

onMounted(() => {
  resize()
  loadImage(props.src)
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
</script>

<template>
  <div class="float-ripple">
    <canvas ref="canvasRef" @pointerdown="onPointerDown" />
  </div>
</template>

<style scoped>
.float-ripple {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
}
.float-ripple canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  touch-action: none;
}
</style>