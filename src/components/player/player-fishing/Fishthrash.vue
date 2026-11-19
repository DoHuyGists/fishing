<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Props {
  /** Ảnh PNG con cá (nền trong suốt) */
  src: string
  /** Chiều rộng hiển thị của cá (px) */
  width?: number
  /** Ảnh gốc quay đầu sang trái (như Barbonymus.png). Đặt true nếu muốn lật đầu sang phải */
  flip?: boolean
  /** Độ mạnh của cú giãy (1 = mặc định, 0.5 = nhẹ, 1.5 = dữ dội) */
  vigor?: number
  /** true = giãy liên tục; false = giãy từng đợt rồi nghỉ */
  continuous?: boolean
  /** Màu sóng và giọt nước */
  rippleColor?: string
  /** Độ dẹt của sóng (góc nhìn): 1 = tròn */
  squash?: number
  /** Chạm/click để cá giãy thêm một đợt */
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: 220,
  flip: false,
  vigor: 1,
  continuous: false,
  rippleColor: '#3b9bb0',
  squash: 0.32,
  clickable: true,
})

interface Ripple { x: number; y: number; t: number; s: number; a: number }
interface Drop { x: number; y: number; vx: number; vy: number; t: number; life: number; r: number }

const canvasRef = ref<HTMLCanvasElement | null>(null)

const STRIPS = 56 // số lát cắt dọc thân cá để uốn cong
const reduceMotion =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let ro: ResizeObserver | null = null
let img: HTMLImageElement | null = null
let W = 0
let H = 0
let last = 0
let phase = 0
let intensity = 0.1
let burstT = 0
let burstDur = 0
let nextBurst = 1
let prevLift = 0
let ambient = 0
let sprayClock = 0
const ripples: Ripple[] = []
const drops: Drop[] = []

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

function loadImage(src: string) {
  const el = new Image()
  el.onload = () => (img = el)
  el.onerror = () => {
    img = null
    console.warn('[FishThrash] Không tải được ảnh:', src)
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
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingQuality = 'high'
  }
}

function addRipple(x: number, y: number, s = 1, a = 1) {
  ripples.push({ x, y, t: 0, s, a })
}

function startBurst() {
  burstDur = rnd(1.3, 2.4)
  burstT = 0
}

function splash(x: number, y: number, power: number) {
  addRipple(x, y, 0.55 + power * 0.7, 0.7 + power * 0.3)
  if (reduceMotion) return
  const n = Math.round(6 + power * 10)
  for (let i = 0; i < n; i++) {
    drops.push({
      x: x + rnd(-props.width * 0.3, props.width * 0.3),
      y,
      vx: rnd(-170, 170) * (0.5 + power),
      vy: -rnd(90, 300) * (0.5 + power),
      t: 0,
      life: rnd(0.5, 0.95),
      r: rnd(1.3, 3.4),
    })
  }
}

function onPointerDown(e: PointerEvent) {
  if (!props.clickable || !canvasRef.value) return
  const r = canvasRef.value.getBoundingClientRect()
  addRipple(e.clientX - r.left, e.clientY - r.top, 1.1)
  startBurst()
}

function updateIntensity(dt: number) {
  let target = 0.1 // run nhẹ khi nằm yên
  if (props.continuous) {
    target = 1
  } else if (burstDur > 0) {
    burstT += dt
    const p = burstT / burstDur
    if (p >= 1) {
      burstDur = 0
      nextBurst = rnd(1.6, 3.6)
    } else {
      target = Math.pow(Math.sin(Math.PI * Math.min(p * 1.15, 1)), 0.6)
    }
  } else {
    nextBurst -= dt
    if (nextBurst <= 0) startBurst()
  }
  target = Math.max(target * props.vigor, 0.1)
  if (reduceMotion) target *= 0.25
  intensity += (target - intensity) * Math.min(1, dt * 9)
}

function drawFish(c: CanvasRenderingContext2D, w: number, h: number, bend: number) {
  if (!img) return
  const sw = img.naturalWidth / STRIPS
  const dw = w / STRIPS
  for (let i = 0; i < STRIPS; i++) {
    const u = (i + 0.5) / STRIPS // 0 = đầu, 1 = đuôi (ảnh gốc quay đầu sang trái)
    const amp = 0.1 + 0.9 * Math.pow(u, 1.6) // đuôi quẩy mạnh hơn đầu
    const off = Math.sin(phase - u * 5.4) * h * 0.3 * bend * amp
    c.drawImage(img, i * sw, 0, sw + 1, img.naturalHeight, -w / 2 + i * dw, -h / 2 + off, dw + 1, h)
  }
}

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  if (!ctx) return
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  const time = now / 1000
  const w = props.width
  const h = img ? (img.naturalHeight / img.naturalWidth) * w : w * 0.45
  const fx = W / 2
  const fy = H / 2
  const sq = props.squash

  updateIntensity(dt)
  phase += dt * (10 + 30 * intensity)

  // Chuyển động tổng thể: nảy lên khỏi mặt nước, nghiêng giật, trượt nhẹ
  const wave = Math.sin(phase * 0.55) * Math.sin(phase * 0.31 + 1)
  const lift = Math.max(0, wave) * h * 0.5 * Math.pow(intensity, 1.2)
  const tilt =
    (Math.sin(time * 7.3) * 0.5 + Math.sin(time * 11.1 + 1) * 0.5) * 0.34 * intensity +
    Math.sin(time * 1.3) * 0.03
  const ox = Math.sin(time * 3.1) * w * 0.03 * intensity
  const oy = -lift + Math.sin(phase) * h * 0.03 * intensity
  const waterY = fy + h * 0.32 // mực nước ở khoảng bụng cá

  // Rơi xuống mặt nước thì bắn sóng và giọt nước
  const lt = h * 0.06
  if (prevLift > lt && lift <= lt) splash(fx + ox, waterY, Math.min(intensity, 1))
  prevLift = lift

  // Quẫy đuôi tạo gợn nhỏ lúc đang giãy mạnh
  sprayClock += dt
  if (intensity > 0.35 && sprayClock > 0.13) {
    sprayClock = 0
    addRipple(fx + ox + rnd(-w * 0.4, w * 0.4), waterY + rnd(-4, 6), 0.3 + intensity * 0.35, 0.8)
  }
  // Gợn nền khi nằm yên
  ambient += dt
  if (ambient > 2) {
    ambient = 0
    addRipple(fx, waterY, 0.6, 0.6)
  }

  ctx.clearRect(0, 0, W, H)

  // Sóng lan
  ctx.strokeStyle = props.rippleColor
  ctx.lineCap = 'round'
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i]
    r.t += dt * (reduceMotion ? 0.5 : 1)
    const life = r.t / 2.8
    if (life >= 1) {
      ripples.splice(i, 1)
      continue
    }
    for (let k = 0; k < 3; k++) {
      const rr = (life * w * 1.7 - k * w * 0.13) * r.s
      if (rr <= 0) continue
      ctx.globalAlpha = Math.max((1 - life) * (0.8 - k * 0.2) * r.a, 0)
      ctx.lineWidth = 2.4 - k * 0.6
      ctx.beginPath()
      ctx.ellipse(r.x, r.y, rr, rr * sq, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Bóng cá trên mặt nước (nhỏ và nhạt dần khi cá nảy lên)
  const lift01 = Math.min(lift / (h * 0.5), 1)
  ctx.globalAlpha = 0.2 * (1 - lift01 * 0.7)
  ctx.fillStyle = props.rippleColor
  ctx.beginPath()
  ctx.ellipse(fx + ox, waterY + 4, w * 0.46 * (1 - lift01 * 0.25), w * 0.46 * sq * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()

  // Vòng nước quanh thân cá, co giãn theo nhịp giãy
  ctx.globalAlpha = 0.65
  ctx.strokeStyle = props.rippleColor
  ctx.lineWidth = 2
  const ringX = w * 0.54 + Math.sin(phase) * w * 0.02 * intensity
  ctx.beginPath()
  ctx.ellipse(fx + ox, waterY, ringX, ringX * sq * 0.55, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Cá
  ctx.save()
  ctx.translate(fx + ox, fy + oy)
  ctx.rotate(props.flip ? -tilt : tilt)
  if (props.flip) ctx.scale(-1, 1)
  drawFish(ctx, w, h, 0.25 + intensity * 0.75)
  ctx.restore()

  // Giọt nước bắn lên
  ctx.fillStyle = props.rippleColor
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]
    d.t += dt
    d.vy += 750 * dt
    d.x += d.vx * dt
    d.y += d.vy * dt
    if (d.t >= d.life || d.y > waterY + 10) {
      drops.splice(i, 1)
      continue
    }
    ctx.globalAlpha = 0.85 * (1 - d.t / d.life)
    ctx.beginPath()
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
    ctx.fill()
  }
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
  nextBurst = 0.8
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
})

watch(() => props.src, loadImage)
</script>

<template>
  <div class="fish-thrash">
    <canvas ref="canvasRef" @pointerdown="onPointerDown" />
  </div>
</template>

<style scoped>
.fish-thrash {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 300px;
}
.fish-thrash canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  touch-action: none;
}
</style>