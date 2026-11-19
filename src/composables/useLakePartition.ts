import { computed } from "vue";
import type { ComputedRef, Ref } from "vue";
import type { Pt, Zone } from "../types/model/lakeEditor";

export function useLakePartition(lake: ComputedRef<Pt[]>, zones: Ref<Zone[]>, inLake: (point: Pt, polygon?: Pt[]) => boolean) {
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

return { cells, mask, NX, NY, STEP, X0, Y0 };
}
