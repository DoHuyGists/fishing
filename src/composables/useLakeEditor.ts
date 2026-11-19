import { ref, computed, watch } from "vue";
import type { Pt, Zone, ShapeKey, DragKind } from "../types/model/lakeEditor";
import { useLakePartition } from "./useLakePartition";

export function useLakeEditor() {

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
const selectedNode = ref<number | null>(null) // node bờ hồ đang chọn (hiện nút "Xóa node")

const selectedNodePt = computed<Pt | null>(() =>
  selectedNode.value === null ? null : (naturalPts.value[selectedNode.value] ?? null),
)
const canRemoveNode = computed(() => naturalPts.value.length > NODE_MIN)

// Vị trí nút "Xóa node": phía trên node, lật xuống dưới nếu sát mép trên
const removeBtnPos = computed<Pt | null>(() => {
  const n = selectedNodePt.value
  if (!n) return null
  const x = clamp(n.x, 50, 550)
  const y = n.y - 42 < 6 ? n.y + 16 : n.y - 42
  return { x, y }
})

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
  selectedNode.value = null
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
  selectedNode.value = null
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
  selectedNode.value = null // chỉ số node đã đổi
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
  selectedNode.value = null
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
const { cells, mask, NX, NY, STEP, X0, Y0 } = useLakePartition(lake, zones, inLake)

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
  if (kind === 'lakeNode') {
    selectedId.value = null
    selectedNode.value = Number(id)
  }
  ;(e.target as Element).setPointerCapture(e.pointerId)
}

// Chọn vùng thì bỏ chọn node bờ hồ; đổi hình hoặc tắt node thì ẩn nút xoá
watch(selectedId, (v) => {
  if (v) selectedNode.value = null
})
watch([isNatural, shapeMode], ([natural, mode]) => {
  if (!natural || !mode) selectedNode.value = null
})

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
return { MAX_ZONES, R_MIN, R_MAX, CX, CY, W_MIN, W_MAX, H_MIN, H_MAX, NODE_MIN, NODE_MAX, SAMPLES, clamp, presets, shapeKey, size, locked, isNatural, nat, defaultNatural, naturalPts, selectedNode, selectedNodePt, canRemoveNode, removeBtnPos, spline, buildLake, lake, lakePoints, inLake, handleRight, handleBottom, seq, palette, zones, pullSeedsIn, reshape, applyPreset, randomNatural, bounds, randomizeLake, resize, insertNode, addNodeAuto, removeNode, onDblClick, cells, mask, NX, NY, STEP, X0, Y0, selectedId, selected, addZone, removeZone, svgRef, shapeMode, drag, toSvg, startDrag, onMove, endDrag, radiusHandle, percentOf };
}
