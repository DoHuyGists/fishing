import type { AquacultureBatch, AquacultureFish, AquaculturePond, AquacultureRules } from '../types/model/aquaculture'

export function batchProgress(batch: AquacultureBatch, now: number): number {
  if (batch.status === 'ready') return 100
  const start = Date.parse(batch.started_at), end = Date.parse(batch.ready_at)
  return Math.max(0, Math.min(100, (now - start) / (end - start) * 100))
}
export function maxStockQuantity(pond: AquaculturePond, rules: AquacultureRules, cash: number): number {
  // Capacity is strictly less than the pond limit. Never use <= here.
  const space = Math.floor((pond.capacity - 1 - pond.used_capacity) / rules.capacity_per_fish)
  const affordable = rules.seed_cash > 0 ? Math.floor(cash / rules.seed_cash) : 10000
  return Math.max(0, Math.min(10000, space, affordable))
}
export function fishSaleCash(fish: AquacultureFish, batch: AquacultureBatch): number {
  return Math.round(fish.weight_kg * batch.rules_snapshot.sale_cash_per_kg)
}
