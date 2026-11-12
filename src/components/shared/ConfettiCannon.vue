<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rotation: number
  spin: number
  tilt: number
  tiltSpeed: number
  color: string
  life: number
  decay: number
  round: boolean
}

export interface FireOptions {
  /** Vị trí nòng pháo theo tỉ lệ màn hình (0–1). Mặc định 0.5 */
  x?: number
  /** 1 = đáy màn hình, 0 = đỉnh. Mặc định 1 */
  y?: number
  /** Góc bắn theo độ: 90 = thẳng lên, 0 = sang phải, 180 = sang trái */
  angle?: number
  /** Độ loe của tia (độ) */
  spread?: number
  /** Lực bắn (tốc độ đầu) */
  power?: number
  /** Số mảnh */
  count?: number
  colors?: string[]
}

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#facc15', '#22c55e',
  '#06b6d4', '#3b82f6', '#a855f7', '#ec4899',
]

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let particles: Particle[] = []
let rafId = 0
let lastTime = 0
let width = 0
let height = 0
const timers: number[] = []

const GRAVITY = 0.35
const DRAG = 0.985

const rand = (min: number, max: number) => Math.random() * (max - min) + min

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  width = window.innerWidth
  height = window.innerHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function fire(options: FireOptions = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const {
    x = 0.5,
    y = 1,
    angle = 90,
    spread = 50,
    power = 28,
    count = 80,
    colors = DEFAULT_COLORS,
  } = options

  for (let i = 0; i < count; i++) {
    const a = ((angle + rand(-spread / 2, spread / 2)) * Math.PI) / 180
    const speed = power * rand(0.4, 1)
    const size = rand(6, 12)

    particles.push({
      x: x * width,
      y: y * height,
      vx: Math.cos(a) * speed,
      vy: -Math.sin(a) * speed,
      w: size,
      h: size * rand(0.4, 0.7),
      rotation: rand(0, Math.PI * 2),
      spin: rand(-0.25, 0.25),
      tilt: rand(0, Math.PI * 2),
      tiltSpeed: rand(0.05, 0.25),
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: rand(0.004, 0.009),
      round: Math.random() < 0.2,
    })
  }
  start()
}

/** Hai khẩu pháo ở hai góc dưới, bắn nhiều đợt */
function fireCannons(waves = 3) {
  for (let i = 0; i < waves; i++) {
    timers.push(
      window.setTimeout(() => {
        fire({ x: 0, angle: 60, spread: 45, power: rand(26, 34) })
        fire({ x: 1, angle: 120, spread: 45, power: rand(26, 34) })
      }, i * 250),
    )
  }
}

function clear() {
  timers.forEach(clearTimeout)
  timers.length = 0
  particles = []
  ctx?.clearRect(0, 0, width, height)
  cancelAnimationFrame(rafId)
  rafId = 0
}

function start() {
  if (rafId) return
  lastTime = performance.now()
  rafId = requestAnimationFrame(tick)
}

function tick(now: number) {
  if (!ctx) return
  const dt = Math.min((now - lastTime) / 16.67, 3) // chuẩn hoá theo 60fps
  lastTime = now

  ctx.clearRect(0, 0, width, height)

  particles = particles.filter((p) => p.life > 0 && p.y < height + 50)

  for (const p of particles) {
    p.vx *= Math.pow(DRAG, dt)
    p.vy = p.vy * Math.pow(DRAG, dt) + GRAVITY * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rotation += p.spin * dt
    p.tilt += p.tiltSpeed * dt
    p.life -= p.decay * dt

    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)
    ctx.scale(1, Math.cos(p.tilt)) // hiệu ứng lật mảnh giấy
    ctx.globalAlpha = Math.min(1, p.life * 2)
    ctx.fillStyle = p.color
    if (p.round) {
      ctx.beginPath()
      ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
    }
    ctx.restore()
  }

  rafId = particles.length ? requestAnimationFrame(tick) : 0
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  clear()
})

defineExpose({ fire, fireCannons, clear })
</script>

<template>
  <canvas
    ref="canvasRef"
    class="pointer-events-none fixed inset-0 z-50 h-full w-full"
    aria-hidden="true"
  />
</template>