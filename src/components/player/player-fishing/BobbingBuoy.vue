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
  /** Bật khi có cá cắn câu: cá quẫy, nước tóe, dây câu giằng co, phao bị giật chìm */
  fishBite?: boolean
  /** Độ dồn dập khi cá quẫy: 0.5 (thưa) – 2 (dồn dập) */
  biteIntensity?: number
  /** Vị trí đầu cần câu (tỉ lệ 0–1 theo chiều rộng / cao của khung) */
  lineAnchorX?: number
  lineAnchorY?: number
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  size: 48,
  waterline: 0.75,
  rippleColor: '#3b9bb0',
  rippleInterval: 1.6,
  squash: 0.32,
  clickable: true,
  fishBite: false,
  biteIntensity: 1,
  lineAnchorX: 0.92,
  lineAnchorY: 0,
})

interface Ripple {
  x: number
  y: number
  t: number
  s: number
}
/** Vòng sóng do cá quẫy tạo ra */
interface Splash {
  x: number
  y: number
  r: number
  max: number
  speed: number
  width: number
}
interface Drop {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  ground: number
}
interface Foam {
  x: number
  y: number
  r: number
  age: number
  life: number
}
interface Delayed {
  at: number
  fn: () => void
}

const canvasRef = ref<HTMLCanvasElement | null>(null)

const GRAVITY = 900

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let ro: ResizeObserver | null = null
let needsResize = false
let biteChanged = false
let img: HTMLImageElement | null = null
let W = 0
let H = 0
let kick = 0
let acc = 0
let last = 0
let simTime = 0
const ripples: Ripple[] = []

// --- trạng thái hiệu ứng cá cắn ---
let presence = 0 // 0..1, mờ dần vào/ra khi bật/tắt cờ
let tension = 0 // 0 = dây chùng, 1 = dây căng cứng
let dive = 0 // lực kéo phao chìm xuống
let nextThrash = 0
let nextWake = 0
const splashes: Splash[] = []
const drops: Drop[] = []
const foams: Foam[] = []
const delayed: Delayed[] = []

const reduceMotion =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

const rand = (a: number, b: number) => a + Math.random() * (b - a)
/** Đơn vị tỉ lệ cho hiệu ứng tóe nước, theo kích thước phao */
const unit = () => props.size / 40

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

/* ---------- Hiệu ứng cá quẫy ---------- */

function later(delay: number, fn: () => void) {
  delayed.push({ at: simTime + delay, fn })
}

function addSplash(x: number, y: number, max: number, speed = 90, width = 1.8) {
  splashes.push({ x, y, r: 2, max, speed, width })
}

function addFoam(x: number, y: number, r: number) {
  foams.push({ x, y, r, age: 0, life: rand(0.35, 0.6) })
}

function addDrops(x: number, y: number, strength: number) {
  if (reduceMotion) return
  const u = unit()
  const n = Math.round(12 + 22 * strength)
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + rand(-0.95, 0.95)
    const speed = rand(140, 120 + 340 * strength) * Math.min(1.4, Math.max(0.7, u))
    drops.push({
      x: x + rand(-8, 8) * u,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: rand(0.9, 2.8) * Math.min(1.3, Math.max(0.8, u)),
      ground: y + rand(-4, 8) * u,
    })
  }
}

/** Một cú quẫy: đuôi cá đập mặt nước, dây giật căng, phao bị kéo chìm */
function thrash(strength = rand(0.55, 1)) {
  if (!W) return
  const u = unit()
  const x = W / 2 + rand(-34, 8) * u
  const y = H / 2 + rand(0, 8) * u

  addFoam(x, y, (22 + 26 * strength) * u)
  addSplash(x, y, (50 + 90 * strength) * u, 120 * u, 2.4)
  addDrops(x, y, strength)

  later(0.12, () => addSplash(x, y, (35 + 60 * strength) * u, 100 * u, 1.6))
  later(0.26, () => addSplash(x, y, (25 + 40 * strength) * u, 85 * u, 1.2))
  // cú đập đuôi thứ hai, nhỏ hơn
  later(0.17, () => {
    const x2 = x + rand(-22, 22) * u
    addFoam(x2, y + 4 * u, (14 + 12 * strength) * u)
    addSplash(x2, y + 4 * u, (30 + 40 * strength) * u, 95 * u, 1.5)
    addDrops(x2, y + 4 * u, strength * 0.5)
  })

  tension = 1
  dive = Math.max(dive, 0.6 + strength * 0.6)
  kick = 1
}

function startBite() {
  // The scene hands its visible line to this canvas when the bite starts.
  presence = 1
  nextThrash = simTime + 0.9
  thrash(1) // cú giật đầu tiên khi cá vừa cắn
  later(0.3, () => thrash(rand(0.6, 0.9)))
}

function endBite() {
  // cá thoát hoặc được kéo lên: một cú quẫy cuối
  thrash(0.7)
}

function updateFish(dt: number) {
  presence += ((props.fishBite ? 1 : 0) - presence) * Math.min(1, dt * 4)
  if (presence < 0.01) presence = 0
  tension = Math.max(props.fishBite ? 0.3 : 0, tension - dt * 0.85)
  dive = Math.max(0, dive - dt * 2.2)

  if (props.fishBite && simTime >= nextThrash) {
    thrash()
    // thỉnh thoảng quẫy dồn 2–3 nhịp liên tiếp
    if (Math.random() < 0.35) {
      later(0.28, () => thrash(rand(0.4, 0.8)))
      if (Math.random() < 0.5) later(0.55, () => thrash(rand(0.3, 0.7)))
    }
    const slow = reduceMotion ? 2 : 1
    nextThrash = simTime + (rand(0.9, 2.4) * slow) / Math.max(0.3, props.biteIntensity)
  }

  // sóng nhỏ liên tục tại điểm dây cắt mặt nước
  if (presence > 0.05 && simTime >= nextWake) {
    const u = unit()
    addSplash(
      W / 2 + rand(-3, 3) * u,
      H / 2 + rand(-1, 2) * u,
      (14 + 22 * tension) * u,
      (40 + 50 * tension) * u,
      1,
    )
    nextWake = simTime + 0.5 - tension * 0.32
  }

  for (let i = delayed.length - 1; i >= 0; i--) {
    if (simTime >= delayed[i].at) {
      delayed[i].fn()
      delayed.splice(i, 1)
    }
  }

  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i]
    s.r += s.speed * dt
    if (s.r >= s.max) splashes.splice(i, 1)
  }

  for (let i = foams.length - 1; i >= 0; i--) {
    foams[i].age += dt
    if (foams[i].age >= foams[i].life) foams.splice(i, 1)
  }

  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]
    d.vy += GRAVITY * dt
    d.x += d.vx * dt
    d.y += d.vy * dt
    if (d.vy > 0 && d.y >= d.ground) {
      if (d.r > 1.6 && Math.random() < 0.6) addSplash(d.x, d.ground, rand(10, 20) * unit(), 45, 0.9)
      drops.splice(i, 1)
    }
  }
}

/* ---------- Vẽ hiệu ứng cá ---------- */

function drawFishShadow(fx: number, fy: number) {
  if (!ctx || presence <= 0) return
  const u = unit()
  const x = fx - 34 * u + Math.sin(simTime * 9) * tension * 10 * u
  const y = fy + 30 * u
  const a = (0.18 + tension * 0.14) * presence
  const soft = (c: CanvasRenderingContext2D, rx: number, ry: number) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx)
    g.addColorStop(0, `rgba(2,20,28,${a})`)
    g.addColorStop(1, 'rgba(2,20,28,0)')
    c.fillStyle = g
    c.save()
    c.scale(1, ry / rx)
    c.beginPath()
    c.arc(0, 0, rx, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.sin(simTime * 11) * 0.25 * tension)
  soft(ctx, 36 * u, 10 * u) // thân
  ctx.translate(32 * u, 0)
  ctx.rotate(Math.sin(simTime * 17) * 0.5 * tension)
  soft(ctx, 20 * u * (1 + tension * 0.6), 11 * u * (1 + tension)) // đuôi
  ctx.restore()
}

function drawSplashes() {
  if (!ctx) return
  const sq = props.squash
  for (const s of splashes) {
    const life = 1 - s.r / s.max
    ctx.lineWidth = s.width
    ctx.strokeStyle = `rgba(235,252,255,${life * 0.6})`
    ctx.beginPath()
    ctx.ellipse(s.x, s.y, s.r, s.r * sq, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = s.width * 0.6
    ctx.globalAlpha = life * 0.45
    ctx.strokeStyle = props.rippleColor
    ctx.beginPath()
    ctx.ellipse(s.x, s.y, s.r * 0.82, s.r * 0.82 * sq, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

function drawFoam() {
  if (!ctx) return
  for (const f of foams) {
    const k = f.age / f.life
    const r = f.r * (0.6 + k * 0.9)
    ctx.save()
    ctx.translate(f.x, f.y)
    ctx.scale(1, props.squash + 0.1)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
    g.addColorStop(0, `rgba(255,255,255,${0.75 * (1 - k)})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawLine(wx: number, wy: number) {
  if (!ctx || presence <= 0) return
  const u = unit()
  const tipX = W * props.lineAnchorX
  const tipY = H * props.lineAnchorY
  const endX = wx + 3 * u

  // dây chùng khi tension thấp, căng và rung khi tension cao
  const sag = (1 - tension) * H * 0.09
  const shake = Math.sin(simTime * 42) * tension * tension * 5
  const cx = (tipX + endX) / 2 + shake
  const cy = (tipY + wy) / 2 + sag

  ctx.lineCap = 'round'

  // phần dây dưới nước (mờ)
  const fx = wx - 34 * u + Math.sin(simTime * 9) * tension * 10 * u
  const fy = wy + 30 * u
  ctx.globalAlpha = presence
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(wx, wy)
  ctx.quadraticCurveTo(wx - 8 * u + shake, wy + 16 * u, fx, fy)
  ctx.stroke()

  // phần dây trên không
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.quadraticCurveTo(cx, cy, endX, wy)
  ctx.stroke()

  // vệt nước kéo theo dây tại điểm chạm
  const w = (10 + tension * 18) * u
  const sq = props.squash
  ctx.strokeStyle = `rgba(255,255,255,${0.25 + tension * 0.4})`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(endX, wy)
  ctx.lineTo(endX + w, wy + w * sq * 0.9)
  ctx.moveTo(endX, wy)
  ctx.lineTo(endX - w * 0.5, wy + w * sq * 1.4)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawDrops() {
  if (!ctx) return
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.88)'
  for (const d of drops) {
    ctx.lineWidth = d.r
    ctx.beginPath()
    ctx.moveTo(d.x, d.y)
    ctx.lineTo(d.x - d.vx * 0.018, d.y - d.vy * 0.018)
    ctx.stroke()
  }
}

/* ---------- Phao ---------- */

function onPointerDown(e: PointerEvent) {
  if (!props.clickable || !canvasRef.value) return
  const r = canvasRef.value.getBoundingClientRect()
  addRipple(e.clientX - r.left, e.clientY - r.top, 1.2)
  kick = 1
  if (props.fishBite) thrash(rand(0.8, 1)) // chạm = giật cần, cá quẫy mạnh hơn
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
  // Resizing clears the bitmap, so do it immediately before drawing the next frame.
  if (needsResize) {
    resize()
    needsResize = false
  }
  if (!ctx) return
  if (biteChanged) {
    if (props.fishBite) startBite()
    else endBite()
    biteChanged = false
  }
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  const time = now / 1000
  simTime = time
  const fx = W / 2
  const fy = H / 2
  const sq = props.squash

  ctx.clearRect(0, 0, W, H)
  updateFish(dt)

  // Tự tỏa sóng
  if (props.rippleInterval > 0) {
    acc += dt
    if (acc > props.rippleInterval) {
      acc = 0
      addRipple(fx, fy)
    }
  }

  // Chuyển động nhấp nhô (cá cắn: phao bị giật chìm + rung theo lực căng dây)
  kick = Math.max(0, kick - dt * 1.2)
  const m = reduceMotion ? 0 : 1
  const base = props.size / 30
  const dip =
    (Math.sin(time * 2.1) * 7 +
      Math.sin(time * 0.9) * 4 +
      kick * Math.sin(time * 14) * 9 +
      dive * 14 +
      tension * presence * Math.sin(time * 19) * 2.5) *
    m
  const tilt =
    (Math.sin(time * 1.3) * 0.08 +
      kick * Math.sin(time * 11) * 0.12 +
      tension * presence * Math.sin(time * 13) * 0.07) *
    m

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

  // Cá, bọt, sóng quẫy và dây câu (nằm dưới phao)
  const waterY = fy + dip * base * 0.35
  drawFishShadow(fx, fy)
  drawSplashes()
  drawFoam()
  drawLine(fx, waterY)

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
  ctx.ellipse(fx, waterY, wr, wr * sq, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Giọt nước bắn lên (vẽ trên cùng)
  drawDrops()
}

onMounted(() => {
  resize()
  loadImage(props.src)
  const parent = canvasRef.value?.parentElement
  if (parent) {
    ro = new ResizeObserver(() => { needsResize = true })
    ro.observe(parent)
  }
  last = performance.now()
  simTime = last / 1000
  if (props.fishBite) startBite()
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
})

watch(() => props.src, loadImage)
watch(
  () => props.fishBite,
  () => { biteChanged = true },
)

defineExpose({ thrash })
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
