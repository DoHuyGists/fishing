import { defineStore } from 'pinia'

export type PondStatus = 'ok' | 'warn' | 'alert'
type EffectKind = 'feed' | 'growth' | 'ready' | 'harvest' | 'stock'

export interface Pond {
  id: number
  name: string
  species: string
  fishColor: string
  col: number
  row: number
  fishCount: number
  capacity: number
  initialWeightG: number
  avgWeightG: number
  growth: number
  fullness: number
  tempC: number
  ph: number
  baseOxygen: number
  aerator: boolean
  lastFed: string
  feedCooldown: number
  cycle: number
  effect: { id: number; kind: EffectKind; text: string; remaining: number } | null
}

const seeds = [
  ['Hồ A1', 'Cá tra', '#c9d3d8', 12000, 640, 29.1, 7.4, 5.6, true],
  ['Hồ A2', 'Cá rô phi', '#e8a0a0', 9500, 410, 30.2, 7.1, 4.6, false],
  ['Hồ A3', 'Cá lóc', '#6b7a4a', 7200, 520, 28.4, 6.9, 5.2, true],
  ['Hồ B1', 'Cá điêu hồng', '#e5533d', 8800, 350, 31, 8.3, 3.4, false],
  ['Hồ B2', 'Cá basa', '#b9c4cc', 10400, 720, 29.6, 7.6, 5.9, true],
  ['Hồ B3', 'Cá chép', '#d9a441', 6100, 480, 28.8, 7.2, 4.4, false],
] as const

export const oxygenOf = (p: Pond) => +(p.baseOxygen + (p.aerator ? 1.5 : 0)).toFixed(1)
export const statusOf = (p: Pond): PondStatus => {
  if (!p.fishCount) return 'ok'
  const oxygen = oxygenOf(p)
  if (p.fullness <= 0 || oxygen < 4 || p.ph > 8.5 || p.ph < 6.5) return 'alert'
  if (p.fullness < 30 || oxygen < 5 || p.ph > 8 || p.tempC > 31) return 'warn'
  return 'ok'
}
export const growthRateOf = (p: Pond) => {
  if (!p.fishCount || p.growth >= 100 || p.fullness <= 0) return 0
  return (100 / 60) * (p.fullness < 30 ? 0.5 : 1) * (oxygenOf(p) < 4 ? 0.5 : oxygenOf(p) < 5 ? 0.75 : 1)
}
export const canFeed = (p: Pond) => p.fishCount > 0 && p.growth < 100 && p.fullness <= 65 && p.feedCooldown <= 0

export const useFishfarmStore = defineStore('fishfarmDemo', {
  state: () => ({
    ponds: seeds.map((s, i): Pond => ({
      id: i + 1, name: s[0], species: s[1], fishColor: s[2],
      col: i % 3, row: Math.floor(i / 3), capacity: s[3], fishCount: s[3],
      initialWeightG: s[4], avgWeightG: s[4], growth: 0, fullness: 65,
      tempC: s[5], ph: s[6], baseOxygen: s[7], aerator: s[8],
      lastFed: 'Chưa cho ăn', feedCooldown: 0, cycle: 1, effect: null,
    })),
    paused: false,
    speed: 1,
    demoCoins: 0,
    harvestedBatches: 0,
    harvestedKg: 0,
    effectSequence: 0,
    announcement: 'Chọn hồ, cho cá ăn và chăm sóc đến khi thu hoạch.',
    lastHarvest: null as { pondName: string; fishCount: number; kg: number; coins: number } | null,
  }),
  getters: {
    totalFish: (s) => s.ponds.reduce((total, p) => total + p.fishCount, 0),
    alertCount: (s) => s.ponds.filter((p) => statusOf(p) === 'alert').length,
    readyCount: (s) => s.ponds.filter((p) => p.fishCount > 0 && p.growth >= 100).length,
  },
  actions: {
    showEffect(p: Pond, kind: EffectKind, text: string) {
      p.effect = { id: ++this.effectSequence, kind, text, remaining: 2.4 }
      this.announcement = `${p.name}: ${text}`
    },
    // Chỉ chạy khi đang xem nông trại; thời gian hiệu ứng luôn theo giây thực.
    tick(seconds: number) {
      if (!Number.isFinite(seconds) || seconds <= 0) return
      const realSeconds = Math.min(seconds, 1)
      for (const p of this.ponds) {
        if (p.effect) {
          p.effect.remaining -= realSeconds
          if (p.effect.remaining <= 0) p.effect = null
        }
        if (this.paused) continue
        const dt = realSeconds * this.speed
        p.feedCooldown = Math.max(0, p.feedCooldown - dt)
        if (!p.fishCount || p.growth >= 100) continue
        const before = p.growth
        p.growth = Math.min(100, before + growthRateOf(p) * dt)
        p.avgWeightG = Math.round(p.initialWeightG + (1000 - p.initialWeightG) * p.growth / 100)
        p.fullness = Math.max(0, p.fullness - dt)
        if (p.growth >= 100) this.showEffect(p, 'ready', 'Cá đã lớn! Thu hoạch thôi!')
        else if (Math.floor(before / 25) < Math.floor(p.growth / 25)) {
          this.showEffect(p, 'growth', `Lớn thêm! ${Math.floor(p.growth)}%`)
        }
      }
    },
    feed(id: number) {
      const p = this.ponds.find((pond) => pond.id === id)
      if (!p || this.paused || !canFeed(p)) return false
      p.fullness = Math.min(100, p.fullness + 35)
      p.feedCooldown = 3
      p.lastFed = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      this.showEffect(p, 'feed', '+35 độ no')
      return true
    },
    toggleAerator(id: number) {
      const p = this.ponds.find((pond) => pond.id === id)
      if (!p) return
      p.aerator = !p.aerator
      this.announcement = `${p.name}: ${p.aerator ? 'Đã bật' : 'Đã tắt'} sục khí.`
    },
    harvest(id: number) {
      const p = this.ponds.find((pond) => pond.id === id)
      if (!p || this.paused || !p.fishCount || p.growth < 100) return false
      const kg = p.fishCount * p.avgWeightG / 1000
      const coins = Math.round(kg * 2)
      this.lastHarvest = { pondName: p.name, fishCount: p.fishCount, kg, coins }
      this.harvestedKg += kg
      this.harvestedBatches++
      this.demoCoins += coins
      p.fishCount = 0
      p.fullness = 0
      this.showEffect(p, 'harvest', `Thu hoạch! +${coins.toLocaleString('vi-VN')} xu thử`)
      return true
    },
    restock(id: number) {
      const p = this.ponds.find((pond) => pond.id === id)
      if (!p || this.paused || p.fishCount) return false
      p.fishCount = p.capacity
      p.avgWeightG = p.initialWeightG
      p.growth = 0
      p.fullness = 65
      p.feedCooldown = 0
      p.lastFed = 'Chưa cho ăn'
      p.cycle++
      this.showEffect(p, 'stock', `Đã thả cá · Lứa ${p.cycle}`)
      return true
    },
    togglePause() { this.paused = !this.paused },
    toggleSpeed() { this.speed = this.speed === 1 ? 3 : 1 },
  },
})
