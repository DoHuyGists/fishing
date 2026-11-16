<script setup lang="ts">
import { ref, computed } from 'vue'

interface Pt {
  x: number
  y: number
}

interface Zone {
  id: string
  name: string
  note: string
  color: string
  seed: Pt // node dời vùng
  r: number // bán kính ảnh hưởng: càng lớn vùng càng rộng
  ang: number // góc của node kéo giãn (chỉ để hiển thị)
}

type ShapeKey = 'natural' | 'ellipse' | 'circle' | 'rect' | 'square' | 'round' | 'hex'
type DragKind = 'seed' | 'radius' | 'lakeW' | 'lakeH' | 'lakeNode'

const MAX_ZONES = 8
const R_MIN = 15
const R_MAX = 260
const CX = 300
const CY = 200
const W_MIN = 160
const W_MAX = 540
const H_MIN = 120
const H_MAX = 340
const NODE_MIN = 6
const NODE_MAX = 24
const SAMPLES = 12 // số điểm nội suy giữa hai node (độ mượt của đường cong)

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/* ---------- Hình dạng dựng sẵn ---------- */
const presets: { key: ShapeKey; label: string; w: number; h: number; icon: string }[] = [
  { key: 'natural', label: 'Tự nhiên', w: 500, h: 300, icon: 'M4 12c0-5 4-8 9-8s8 3 7 8-4 8-9 8-7-3-7-8z' },
  { key: 'ellipse', label: 'Bầu dục', w: 500, h: 300, icon: 'M2 12a10 6.5 0 1 0 20 0a10 6.5 0 1 0-20 0z' },
  { key: 'circle', label: 'Tròn', w: 320, h: 320, icon: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0z' },
  { key: 'rect', label: 'Chữ nhật', w: 500, h: 300, icon: 'M2 6h20v12H2z' },
  { key: 'square', label: 'Vuông', w: 320, h: 320, icon: 'M4 4h16v16H4z' },
  { key: 'round', label: 'Bo góc', w: 500, h: 300, icon: 'M6 5h12a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z' },
  { key: 'hex', label: 'Lục giác', w: 500, h: 300, icon: 'M7 4h10l5 8-5 8H7l-5-8z' },
]

const shapeKey = ref<ShapeKey>('natural')
const size = ref({ w: 500, h: 300 })
const locked = computed(() => shapeKey.value === 'circle' || shapeKey.value === 'square')
const isNatural = computed(() => shapeKey.value === 'natural')

/* ---------- Khuôn "Tự nhiên": nhiều node điều khiển ---------- */
const nat = (t: number) => (1 + 0.05 * Math.sin(2 * t + 0.6) + 0.04 * Math.sin(3 * t + 1.8)) / 1.09

function defaultNatural(): Pt[] {
  return Array.from({ length: 12 }, (_, i) => {
    const t = (i / 12) * Math.PI * 2
    const k = nat(t)
    return { x: CX + 250 * k * Math.cos(t), y: CY + 150 * k * Math.sin(t) }
  })
}

const naturalPts = ref<Pt[]>(defaultNatural())

// Đường cong Catmull-Rom khép kín đi qua tất cả node
function spline(pts: Pt[]): Pt[] {
  const n = pts.length
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    for (let s = 0; s < SAMPLES; s++) {
      const t = s / SAMPLES
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) })
    }
  }
  return out
}

function buildLake(shape: ShapeKey, w: number, h: number): Pt[] {
  const rx = w / 2
  const ry = h / 2
  const ellipse = () =>
    Array.from({ length: 180 }, (_, i) => {
      const t = (i / 180) * Math.PI * 2
      return { x: CX + rx * Math.cos(t), y: CY + ry * Math.sin(t) }
    })

  switch (shape) {
    case 'natural':
      return spline(naturalPts.value)
    case 'ellipse':
    case 'circle':
      return ellipse()
    case 'rect':
    case 'square':
      return [
        { x: CX - rx, y: CY - ry },
        { x: CX + rx, y: CY - ry },
        { x: CX + rx, y: CY + ry },
        { x: CX - rx, y: CY + ry },
      ]
    case 'round': {
      const rr = Math.min(rx, ry) * 0.35
      const corners = [
        { cx: CX + rx - rr, cy: CY - ry + rr, a0: -90 },
        { cx: CX + rx - rr, cy: CY + ry - rr, a0: 0 },
        { cx: CX - rx + rr, cy: CY + ry - rr, a0: 90 },
        { cx: CX - rx + rr, cy: CY - ry + rr, a0: 180 },
      ]
      const pts: Pt[] = []
      for (const c of corners) {
        for (let s = 0; s <= 10; s++) {
          const a = ((c.a0 + (s / 10) * 90) * Math.PI) / 180
          pts.push({ x: c.cx + rr * Math.cos(a), y: c.cy + rr * Math.sin(a) })
        }
      }
      return pts
    }
    case 'hex':
      return [
        { x: CX - rx, y: CY },
        { x: CX - rx / 2, y: CY - ry },
        { x: CX + rx / 2, y: CY - ry },
        { x: CX + rx, y: CY },
        { x: CX + rx / 2, y: CY + ry },
        { x: CX - rx / 2, y: CY + ry },
      ]
  }
}

const lake = computed(() => buildLake(shapeKey.value, size.value.w, size.value.h))
const lakePoints = computed(() => lake.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))

function inLake(p: Pt, poly: Pt[] = lake.value): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

// Node kéo biên cho các hình có tham số (không dùng cho "Tự nhiên")
const handleRight = computed<Pt>(() => ({ x: CX + size.value.w / 2, y: CY }))
const handleBottom = computed<Pt>(() => ({ x: CX, y: CY + size.value.h / 2 }))

/* ---------- Dữ liệu vùng ---------- */
let seq = 6
const palette = ['#c084fc', '#f472b6', '#facc15', '#34d399', '#fb923c', '#60a5fa']

const zones = ref<Zone[]>([
  { id: 'z1', name: 'Vùng nước nông ven bờ', note: 'Nhiều rong rêu', color: '#8fbf6a', seed: { x: 150, y: 145 }, r: 70, ang: 0 },
  { id: 'z2', name: 'Vùng nước xoáy dòng chảy', note: 'Khó câu', color: '#e8894a', seed: { x: 215, y: 265 }, r: 60, ang: 0 },
  { id: 'z3', name: 'Vùng phổ biến', note: 'Ít cá lớn', color: '#3f8fc9', seed: { x: 390, y: 290 }, r: 70, ang: 0 },
  { id: 'z4', name: 'Vùng nước sâu tĩnh lặng', note: 'Cá lớn', color: '#1f5f9e', seed: { x: 430, y: 150 }, r: 70, ang: 0 },
  { id: 'z5', name: 'Vùng giữa hồ', note: 'Cá vừa', color: '#5fb3b3', seed: { x: 300, y: 190 }, r: 50, ang: 0 },
])

// Node vùng nào rơi ra ngoài hồ thì kéo vào trong
function pullSeedsIn() {
  for (const z of zones.value) {
    let guard = 0
    while (!inLake(z.seed) && guard++ < 60) {
      z.seed = { x: CX + (z.seed.x - CX) * 0.95, y: CY + (z.seed.y - CY) * 0.95 }
    }
  }
}

/* ---------- Đổi hình dạng / kích thước hồ ---------- */
function reshape(shape: ShapeKey, w: number, h: number) {
  const sx = w / size.value.w
  const sy = h / size.value.h
  for (const z of zones.value) {
    z.seed = { x: CX + (z.seed.x - CX) * sx, y: CY + (z.seed.y - CY) * sy }
    z.r = clamp(z.r * Math.sqrt(sx * sy), R_MIN, R_MAX)
  }
  shapeKey.value = shape
  size.value = { w, h }
  pullSeedsIn()
}

function applyPreset(key: ShapeKey) {
  const p = presets.find((p) => p.key === key)!
  if (key === 'natural') naturalPts.value = defaultNatural() // bấm lại "Tự nhiên" = đặt lại hình
  reshape(p.key, p.w, p.h)
}

/* ---------- Hình hồ ngẫu nhiên ---------- */
// Sinh các node quanh tâm với độ dài bán kính thay đổi. Góc chỉ lệch nhẹ nên
// thứ tự node được giữ và bờ hồ không tự cắt nhau.
function randomNatural(): Pt[] {
  const n = 8 + Math.floor(Math.random() * 7) // 8–14 node
  const rx = 170 + Math.random() * 95
  const ry = 105 + Math.random() * 60
  const cx = CX + (Math.random() - 0.5) * 30
  const cy = CY + (Math.random() - 0.5) * 20
  const phase = Math.random() * Math.PI * 2
  const harmonics = [2, 3, 4].map((m) => ({
    m,
    amp: Math.random() * (0.2 / (m - 1)),
    ph: Math.random() * Math.PI * 2,
  }))
  const step = (Math.PI * 2) / n

  return Array.from({ length: n }, (_, i) => {
    const t = phase + i * step + (Math.random() - 0.5) * step * 0.7
    let k = 1 + (Math.random() - 0.5) * 0.24
    for (const h of harmonics) k += h.amp * Math.sin(h.m * t + h.ph)
    k = clamp(k, 0.55, 1.12)
    return {
      x: clamp(cx + rx * k * Math.cos(t), 40, 560),
      y: clamp(cy + ry * k * Math.sin(t), 40, 360),
    }
  })
}

function bounds(poly: Pt[]) {
  const xs = poly.map((p) => p.x)
  const ys = poly.map((p) => p.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

function randomizeLake() {
  const old = bounds(lake.value)
  naturalPts.value = randomNatural()
  shapeKey.value = 'natural'
  size.value = { w: 500, h: 300 }
  const now = bounds(lake.value)

  // Co giãn bố cục các vùng theo khung của hồ mới
  const sx = clamp((now.maxX - now.minX) / (old.maxX - old.minX || 1), 0.4, 2.5)
  const sy = clamp((now.maxY - now.minY) / (old.maxY - old.minY || 1), 0.4, 2.5)
  const ocx = (old.minX + old.maxX) / 2
  const ocy = (old.minY + old.maxY) / 2
  const ncx = (now.minX + now.maxX) / 2
  const ncy = (now.minY + now.maxY) / 2
  for (const z of zones.value) {
    z.seed = { x: ncx + (z.seed.x - ocx) * sx, y: ncy + (z.seed.y - ocy) * sy }
    z.r = clamp(z.r * Math.sqrt(sx * sy), R_MIN, R_MAX)
  }
  pullSeedsIn()
}

function resize(next: { w?: number; h?: number }) {
  let w = next.w ?? size.value.w
  let h = next.h ?? size.value.h
  if (locked.value) {
    w = h = clamp(next.w ?? next.h ?? w, W_MIN, H_MAX)
  } else {
    w = clamp(w, W_MIN, W_MAX)
    h = clamp(h, H_MIN, H_MAX)
  }
  reshape(shapeKey.value, w, h)
}

/* ---------- Thêm / xoá node của hồ tự nhiên ---------- */
function insertNode(afterIndex: number, p: Pt) {
  if (naturalPts.value.length >= NODE_MAX) return
  naturalPts.value.splice(afterIndex + 1, 0, { x: p.x, y: p.y })
}

function addNodeAuto() {
  // Chèn vào đoạn dài nhất, đúng trên đường cong
  const pts = naturalPts.value
  let bestI = 0
  let bestLen = -1
  for (let i = 0; i < pts.length; i++) {
    const q = pts[(i + 1) % pts.length]
    const len = Math.hypot(q.x - pts[i].x, q.y - pts[i].y)
    if (len > bestLen) {
      bestLen = len
      bestI = i
    }
  }
  insertNode(bestI, lake.value[bestI * SAMPLES + SAMPLES / 2])
}

function removeNode(i: number) {
  if (naturalPts.value.length <= NODE_MIN) return
  naturalPts.value.splice(i, 1)
  pullSeedsIn()
}

// Bấm đúp lên đường bờ để thêm node tại đó
function onDblClick(e: MouseEvent) {
  if (!isNatural.value || !shapeMode.value) return
  const p = toSvg(e)
  const poly = lake.value
  let bestIdx = 0
  let bestD = Infinity
  for (let i = 0; i < poly.length; i++) {
    const d = Math.hypot(poly[i].x - p.x, poly[i].y - p.y)
    if (d < bestD) {
      bestD = d
      bestIdx = i
    }
  }
  if (bestD > 14) return
  insertNode(Math.floor(bestIdx / SAMPLES), poly[bestIdx])
}

/* ---------- Lưới tính toán ---------- */
const STEP = 4
const X0 = 20
const Y0 = 20
const NX = 141
const NY = 91
const N = NX * NY

const WARP = 1 // độ uốn của ranh giới giữa các vùng
function warp(x: number, y: number): Pt {
  return {
    x: x + WARP * (12 * Math.sin(y * 0.021 + 1.3) + 6 * Math.sin(y * 0.047 + 0.4)),
    y: y + WARP * (12 * Math.sin(x * 0.018 + 2.1) + 6 * Math.sin(x * 0.05 + 3)),
  }
}

const wx = new Float32Array(N)
const wy = new Float32Array(N)
for (let j = 0; j < NY; j++) {
  for (let i = 0; i < NX; i++) {
    const w = warp(X0 + i * STEP, Y0 + j * STEP)
    wx[j * NX + i] = w.x
    wy[j * NX + i] = w.y
  }
}

// Nút lưới nào nằm trong hồ (tính lại khi hồ đổi)
const mask = computed(() => {
  const poly = lake.value
  const xs = poly.map((p) => p.x)
  const ys = poly.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const arr = new Uint8Array(N)
  let count = 0
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const x = X0 + i * STEP
      const y = Y0 + j * STEP
      if (x < minX || x > maxX || y < minY || y > maxY) continue
      if (inLake({ x, y }, poly)) {
        arr[j * NX + i] = 1
        count++
      }
    }
  }
  return { inside: arr, count }
})

/* ---------- Marching squares + làm mượt ---------- */
const CASES: number[][][] = [
  [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]], [[1, 3]], [[0, 1]], [[3, 0]], [],
]

function contours(f: Float32Array): Pt[][] {
  const pts = new Map<string, Pt>()
  const adj = new Map<string, string[]>()

  const edge = (i: number, j: number, e: number): string => {
    let key: string
    let a: number
    let b: number
    if (e === 0) { key = `h${i},${j}`; a = j * NX + i; b = a + 1 }
    else if (e === 2) { key = `h${i},${j + 1}`; a = (j + 1) * NX + i; b = a + 1 }
    else if (e === 3) { key = `v${i},${j}`; a = j * NX + i; b = a + NX }
    else { key = `v${i + 1},${j}`; a = j * NX + i + 1; b = a + NX }
    if (!pts.has(key)) {
      const t = f[a] / (f[a] - f[b])
      const ax = X0 + (a % NX) * STEP
      const ay = Y0 + Math.floor(a / NX) * STEP
      const bx = X0 + (b % NX) * STEP
      const by = Y0 + Math.floor(b / NX) * STEP
      pts.set(key, { x: ax + (bx - ax) * t, y: ay + (by - ay) * t })
    }
    return key
  }

  for (let j = 0; j < NY - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const k = j * NX + i
      const idx =
        (f[k] > 0 ? 1 : 0) | (f[k + 1] > 0 ? 2 : 0) | (f[k + NX + 1] > 0 ? 4 : 0) | (f[k + NX] > 0 ? 8 : 0)
      for (const [e1, e2] of CASES[idx]) {
        const a = edge(i, j, e1)
        const b = edge(i, j, e2)
        if (!adj.has(a)) adj.set(a, [])
        if (!adj.has(b)) adj.set(b, [])
        adj.get(a)!.push(b)
        adj.get(b)!.push(a)
      }
    }
  }

  const seen = new Set<string>()
  const loops: Pt[][] = []
  for (const start of adj.keys()) {
    if (seen.has(start)) continue
    const loop: Pt[] = []
    let prev: string | null = null
    let cur = start
    while (!seen.has(cur)) {
      seen.add(cur)
      loop.push(pts.get(cur)!)
      const n = adj.get(cur)!
      const next = n[0] === prev && n.length > 1 ? n[1] : n[0]
      prev = cur
      cur = next
    }
    if (loop.length > 2) loops.push(loop)
  }
  return loops
}

function chaikin(loop: Pt[], rounds = 2): Pt[] {
  let p = loop
  for (let r = 0; r < rounds; r++) {
    const q: Pt[] = []
    for (let i = 0; i < p.length; i++) {
      const a = p[i]
      const b = p[(i + 1) % p.length]
      q.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y })
      q.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y })
    }
    p = q
  }
  return p
}

function toPath(loops: Pt[][]): string {
  return loops
    .map((l) => 'M' + l.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L') + 'Z')
    .join('')
}

/* ---------- Chia vùng (power diagram có uốn) ---------- */
const cells = computed(() => {
  const zs = zones.value
  const m = zs.length
  const { inside, count: lakeCount } = mask.value

  // P = d² − r²: vùng có r lớn "hút" nhiều diện tích hơn
  const P = zs.map((z) => {
    const s = warp(z.seed.x, z.seed.y)
    const w = z.r * z.r
    const arr = new Float32Array(N)
    for (let k = 0; k < N; k++) {
      const dx = wx[k] - s.x
      const dy = wy[k] - s.y
      arr[k] = dx * dx + dy * dy - w
    }
    return arr
  })

  const fields = zs.map((_, a) => {
    const f = new Float32Array(N)
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i
        if (i === 0 || j === 0 || i === NX - 1 || j === NY - 1) {
          f[k] = -1
          continue
        }
        let best = 1e9
        for (let b = 0; b < m; b++) if (b !== a && P[b][k] < best) best = P[b][k]
        f[k] = best - P[a][k]
      }
    }
    return f
  })

  const cnt = new Array(m).fill(0)
  const sumX = new Array(m).fill(0)
  const sumY = new Array(m).fill(0)
  for (let k = 0; k < N; k++) {
    if (!inside[k]) continue
    for (let a = 0; a < m; a++) {
      if (fields[a][k] > 0) {
        cnt[a]++
        sumX[a] += X0 + (k % NX) * STEP
        sumY[a] += Y0 + Math.floor(k / NX) * STEP
        break
      }
    }
  }

  return zs.map((z, a) => ({
    zone: z,
    d: toPath(contours(fields[a]).map((l) => chaikin(l))),
    hasArea: cnt[a] > 0,
    center: cnt[a] ? { x: sumX[a] / cnt[a], y: sumY[a] / cnt[a] } : { ...z.seed },
    percent: lakeCount ? Math.round((cnt[a] / lakeCount) * 100) : 0,
  }))
})

/* ---------- Thêm / xoá vùng ---------- */
const selectedId = ref<string | null>(null)
const selected = computed(() => zones.value.find((z) => z.id === selectedId.value) ?? null)

function addZone() {
  if (zones.value.length >= MAX_ZONES) return
  const { inside } = mask.value
  // Chọn điểm trong hồ xa các vùng hiện có nhất, và không sát bờ
  let best: Pt = { x: CX, y: CY }
  let bestScore = -1
  for (let j = 0; j < NY; j += 2) {
    for (let i = 0; i < NX; i += 2) {
      if (!inside[j * NX + i]) continue
      const p = { x: X0 + i * STEP, y: Y0 + j * STEP }
      if (![[20, 0], [-20, 0], [0, 20], [0, -20]].every(([dx, dy]) => inLake({ x: p.x + dx, y: p.y + dy }))) continue
      let score = 1e9
      for (const z of zones.value) score = Math.min(score, Math.hypot(p.x - z.seed.x, p.y - z.seed.y))
      if (score > bestScore) {
        bestScore = score
        best = p
      }
    }
  }
  const id = 'z' + seq++
  zones.value.push({
    id,
    name: `Vùng mới ${seq - 5}`,
    note: '',
    color: palette[(seq - 6) % palette.length],
    seed: best,
    r: 50,
    ang: 0,
  })
  selectedId.value = id
}

function removeZone(id: string) {
  zones.value = zones.value.filter((z) => z.id !== id)
  if (selectedId.value === id) selectedId.value = null
}

/* ---------- Kéo node ---------- */
const svgRef = ref<SVGSVGElement | null>(null)
const shapeMode = ref(true)
const drag = ref<{ id: string; kind: DragKind } | null>(null)

function toSvg(e: PointerEvent | MouseEvent): Pt {
  const svg = svgRef.value!
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
  return { x: p.x, y: p.y }
}

function startDrag(id: string, kind: DragKind, e: PointerEvent) {
  drag.value = { id, kind }
  if (kind === 'seed' || kind === 'radius') selectedId.value = id
  ;(e.target as Element).setPointerCapture(e.pointerId)
}

function onMove(e: PointerEvent) {
  if (!drag.value) return
  const p = toSvg(e)
  const kind = drag.value.kind

  if (kind === 'lakeNode') {
    const i = Number(drag.value.id)
    if (naturalPts.value[i]) {
      naturalPts.value[i] = { x: clamp(p.x, 40, 560), y: clamp(p.y, 40, 360) }
      pullSeedsIn()
    }
    return
  }
  if (kind === 'lakeW') {
    resize({ w: 2 * Math.abs(p.x - CX) })
    return
  }
  if (kind === 'lakeH') {
    resize({ h: 2 * Math.abs(p.y - CY) })
    return
  }

  const z = zones.value.find((z) => z.id === drag.value!.id)
  if (!z) return
  if (kind === 'seed') {
    if (inLake(p)) z.seed = p
  } else {
    const dx = p.x - z.seed.x
    const dy = p.y - z.seed.y
    z.r = clamp(Math.hypot(dx, dy), R_MIN, R_MAX)
    z.ang = Math.atan2(dy, dx)
  }
}

function endDrag() {
  drag.value = null
}

const radiusHandle = (z: Zone): Pt => ({
  x: z.seed.x + z.r * Math.cos(z.ang),
  y: z.seed.y + z.r * Math.sin(z.ang),
})

function percentOf(id: string): number {
  return cells.value.find((c) => c.zone.id === id)?.percent ?? 0
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:flex-row">
    <!-- Bản đồ -->
    <div class="flex-1">
      <div class="overflow-hidden rounded-xl border border-slate-300 bg-[#d9d2b8] shadow-sm">
        <svg
          ref="svgRef"
          viewBox="0 0 600 400"
          class="block h-auto w-full select-none"
          @pointermove="onMove"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @click="selectedId = null"
          @dblclick="onDblClick"
        >
          <defs>
            <clipPath id="lake-clip-nodes">
              <polygon :points="lakePoints" />
            </clipPath>
          </defs>

          <polygon
            :points="lakePoints"
            fill="#5b8db8"
            stroke="#f2ecd5"
            stroke-width="14"
            stroke-linejoin="round"
          />

          <g clip-path="url(#lake-clip-nodes)">
            <path
              v-for="c in cells"
              :key="c.zone.id"
              :d="c.d"
              fill-rule="evenodd"
              :fill="c.zone.color"
              :stroke="selectedId === c.zone.id ? '#fff' : 'rgba(255,255,255,.6)'"
              :stroke-width="selectedId === c.zone.id ? 3.5 : 1.5"
              stroke-linejoin="round"
              class="cursor-pointer transition-opacity hover:opacity-90"
              :class="selectedId && selectedId !== c.zone.id ? 'opacity-60' : ''"
              @click.stop="selectedId = selectedId === c.zone.id ? null : c.zone.id"
            />
          </g>

          <!-- Nhãn vùng -->
          <g class="pointer-events-none" text-anchor="middle">
            <g v-for="c in cells" :key="'l-' + c.zone.id">
              <template v-if="c.hasArea">
                <text
                  :x="c.center.x"
                  :y="c.center.y"
                  font-size="12"
                  font-weight="700"
                  fill="#fff"
                  stroke="rgba(0,0,0,.45)"
                  stroke-width="3"
                  paint-order="stroke"
                >
                  {{ c.zone.name }}
                </text>
                <text
                  :x="c.center.x"
                  :y="c.center.y + 15"
                  font-size="11"
                  fill="#fff"
                  stroke="rgba(0,0,0,.45)"
                  stroke-width="3"
                  paint-order="stroke"
                >
                  {{ c.zone.note ? c.zone.note + ' · ' : '' }}{{ c.percent }}%
                </text>
              </template>
            </g>
          </g>

          <!-- Các node chỉnh sửa -->
          <g v-if="shapeMode">
            <!-- Vòng bán kính + node kéo giãn của vùng đang chọn -->
            <template v-if="selected">
              <circle
                :cx="selected.seed.x"
                :cy="selected.seed.y"
                :r="selected.r"
                fill="none"
                stroke="#fff"
                stroke-width="1.5"
                stroke-dasharray="5 4"
                class="pointer-events-none"
              />
              <line
                :x1="selected.seed.x"
                :y1="selected.seed.y"
                :x2="radiusHandle(selected).x"
                :y2="radiusHandle(selected).y"
                stroke="#fff"
                stroke-width="1.5"
                class="pointer-events-none"
              />
              <rect
                :x="radiusHandle(selected).x - 6"
                :y="radiusHandle(selected).y - 6"
                width="12"
                height="12"
                rx="2"
                fill="#fff"
                :stroke="selected.color"
                stroke-width="3"
                class="cursor-nwse-resize"
                style="touch-action: none"
                @click.stop
                @pointerdown.stop="startDrag(selected.id, 'radius', $event)"
              />
            </template>

            <!-- Node dời vùng -->
            <circle
              v-for="z in zones"
              :key="'h-' + z.id"
              :cx="z.seed.x"
              :cy="z.seed.y"
              r="8"
              fill="#fff"
              :stroke="z.color"
              stroke-width="4"
              class="cursor-grab"
              style="touch-action: none"
              @click.stop
              @pointerdown.stop="startDrag(z.id, 'seed', $event)"
            />

            <!-- Hồ tự nhiên: nhiều node trên đường bờ -->
            <template v-if="isNatural">
              <circle
                v-for="(n, i) in naturalPts"
                :key="'n-' + i"
                :cx="n.x"
                :cy="n.y"
                r="6"
                fill="#1e293b"
                stroke="#fff"
                stroke-width="2"
                class="cursor-move"
                style="touch-action: none"
                @click.stop
                @dblclick.stop="removeNode(i)"
                @pointerdown.stop="startDrag(String(i), 'lakeNode', $event)"
              />
            </template>

            <!-- Các hình còn lại: 2 thanh kéo giãn biên -->
            <template v-else>
              <rect
                :x="handleRight.x - 5"
                :y="handleRight.y - 12"
                width="10"
                height="24"
                rx="4"
                fill="#1e293b"
                stroke="#fff"
                stroke-width="2"
                class="cursor-ew-resize"
                style="touch-action: none"
                @click.stop
                @pointerdown.stop="startDrag('', 'lakeW', $event)"
              />
              <rect
                :x="handleBottom.x - 12"
                :y="handleBottom.y - 5"
                width="24"
                height="10"
                rx="4"
                fill="#1e293b"
                stroke="#fff"
                stroke-width="2"
                class="cursor-ns-resize"
                style="touch-action: none"
                @click.stop
                @pointerdown.stop="startDrag('', 'lakeH', $event)"
              />
            </template>
          </g>
        </svg>
      </div>

      <p class="mt-2 text-xs text-slate-500">
        Chấm tròn trắng: dời vùng. Ô vuông (khi chọn một vùng): kéo giãn diện tích. Chấm hoặc thanh đen trên bờ hồ: chỉnh hình dạng hồ.
      </p>
    </div>

    <!-- Bảng điều khiển -->
    <aside class="w-full space-y-4 lg:w-80">
      <!-- Hình dạng hồ -->
      <section class="rounded-xl border border-slate-200 bg-white p-3">
        <h3 class="mb-2 text-sm font-semibold text-slate-800">Hình dạng hồ</h3>
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="p in presets"
            :key="p.key"
            class="flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            :class="
              shapeKey === p.key
                ? 'border-sky-500 bg-sky-50 text-sky-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            "
            @click="applyPreset(p.key)"
          >
            <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
              <path :d="p.icon" />
            </svg>
            {{ p.label }}
          </button>

          <!-- Hình tự do không biết trước; sau đó vẫn chỉnh tiếp bằng node -->
          <button
            class="flex flex-col items-center gap-0.5 rounded-lg border border-dashed border-slate-300 px-1 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            @click="randomizeLake"
          >
            <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
              <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
              <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
            </svg>
            Ngẫu nhiên
          </button>
        </div>

        <!-- Tự nhiên: chỉnh bằng node -->
        <div v-if="isNatural" class="mt-3 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-500">Số node: {{ naturalPts.length }}/{{ NODE_MAX }}</span>
            <button
              class="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="naturalPts.length >= NODE_MAX"
              @click="addNodeAuto"
            >
              Thêm node
            </button>
          </div>
          <p class="text-xs text-slate-500">
            Kéo chấm đen để uốn bờ hồ. Bấm đúp lên bờ để thêm node, bấm đúp vào node để xoá (tối thiểu {{ NODE_MIN }}).
            Bấm lại "Tự nhiên" để đặt lại hình ban đầu.
          </p>
        </div>

        <!-- Các hình khác: chỉnh bằng thanh trượt -->
        <div v-else class="mt-3 space-y-2">
          <label class="block text-xs text-slate-500">
            {{ locked ? 'Kích thước' : 'Chiều rộng' }}: {{ Math.round(size.w) }}
            <input
              type="range"
              :min="W_MIN"
              :max="locked ? H_MAX : W_MAX"
              :value="size.w"
              class="mt-1 w-full accent-sky-600"
              @input="resize({ w: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
          <label v-if="!locked" class="block text-xs text-slate-500">
            Chiều cao: {{ Math.round(size.h) }}
            <input
              type="range"
              :min="H_MIN"
              :max="H_MAX"
              :value="size.h"
              class="mt-1 w-full accent-sky-600"
              @input="resize({ h: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
        </div>
      </section>

      <!-- Danh sách vùng -->
      <section class="rounded-xl border border-slate-200 bg-white p-3">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-800">Các vùng ({{ zones.length }}/{{ MAX_ZONES }})</h3>
          <div class="flex gap-1.5">
            <button
              class="rounded-md px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              :class="shapeMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
              @click="shapeMode = !shapeMode"
            >
              Node
            </button>
            <button
              class="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="zones.length >= MAX_ZONES"
              @click="addZone"
            >
              Thêm vùng
            </button>
          </div>
        </div>

        <ul class="space-y-1.5">
          <li
            v-for="z in zones"
            :key="z.id"
            class="flex items-center gap-2 rounded-lg border px-2 py-1.5"
            :class="selectedId === z.id ? 'border-sky-500 bg-sky-50' : 'border-slate-200'"
            @click="selectedId = z.id"
          >
            <input
              v-model="z.color"
              type="color"
              class="h-6 w-6 shrink-0 cursor-pointer rounded border-0 p-0"
              aria-label="Màu vùng"
              @click.stop
            />
            <input
              v-model="z.name"
              class="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-slate-900 hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:outline-none"
              aria-label="Tên vùng"
              @focus="selectedId = z.id"
              @click.stop
            />
            <span class="w-9 shrink-0 text-right text-xs tabular-nums text-slate-500">
              {{ percentOf(z.id) }}%
            </span>
            <button
              class="shrink-0 rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label="Xoá vùng"
              @click.stop="removeZone(z.id)"
            >
              Xoá
            </button>
          </li>
          <li v-if="!zones.length" class="text-sm text-slate-500">Chưa có vùng nào. Bấm "Thêm vùng".</li>
        </ul>
      </section>

      <section v-if="selected" class="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <h3 class="text-sm font-semibold text-slate-800">{{ selected.name || 'Vùng đang chọn' }}</h3>
        <label class="block text-xs text-slate-500">
          Ghi chú
          <input
            v-model="selected.note"
            class="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>
        <label class="block text-xs text-slate-500">
          Kích thước vùng
          <input
            v-model.number="selected.r"
            type="range"
            :min="R_MIN"
            :max="R_MAX"
            class="mt-1 w-full accent-sky-600"
          />
        </label>
        <p v-if="!percentOf(selected.id)" class="text-xs text-amber-600">
          Vùng này đang bị các vùng khác lấn hết. Hãy tăng kích thước hoặc dời node ra chỗ trống.
        </p>
      </section>
    </aside>
  </div>
</template>