import type { SpeciesRow } from "../../../types/table/species";
import type { AquacultureRuleRow, AquacultureRulePayload } from "../../../types/table/aquacultureAdmin";
import { defineStore } from 'pinia'
import { supabaseSpeciesRepository } from '../../../data/supabaseSpeciesRepository';
import { supabaseAquacultureRulesAdminRepository as repository } from '../../../data/supabaseAquacultureAdminRepository';

export function numberField(payload: Record<string, unknown>, key: string, min: number, max = Infinity, integer = false): number {
  const raw = payload[key], value = Number(raw)
  if (raw === null || raw === undefined || raw === '' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error('Giá trị không hợp lệ: ' + key + (integer ? ' (yêu cầu số nguyên)' : ''))
  }
  return value
}
export function enabledField(value: unknown): boolean {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  throw new Error('Hãy chọn trạng thái bật hoặc tắt.')
}

export const useAdminAquacultureSpeciesStore = defineStore('AdminAquacultureSpecies', {
  state: () => ({ items: [] as AquacultureRuleRow[], species: [] as SpeciesRow[], loading: false, error: '', page: 1, pageSize: 10, total: 0, search: '', requestId: 0 }),
  actions: {
    async fetchAll(page?: number, search?: string) {
      page ??= this.page; this.search = search ?? this.search;
      const request = ++this.requestId;
      this.loading = true; this.error = ''
      try {
        const [result, species] = await Promise.all([repository.fetchPage(page, this.search), this.species.length ? Promise.resolve(this.species) : supabaseSpeciesRepository.fetchAll()]);
        if (request !== this.requestId) return;
        this.items = result.items; this.species = species; this.total = result.total; this.page = page;
        if (!result.items.length && page > 1) await this.fetchAll(Math.max(1, Math.ceil(result.total / this.pageSize)));
      }
      catch (error) { if (request === this.requestId) this.error = error instanceof Error ? error.message : 'Không tải được cấu hình loài nuôi.' }
      finally { if (request === this.requestId) this.loading = false }
    },
    async save(input: Record<string, unknown>, id: string | null) {
      const current = id ? this.items.find(r => r.id === id) : null
      if (id && !current) throw new Error('Cấu hình không còn tồn tại. Hãy tải lại.')
      const speciesId = id ?? String(input.species_id ?? '')
      if (!this.species.some(s => s.id === speciesId)) throw new Error('Hãy chọn loài cá hợp lệ.')
      const payload: AquacultureRulePayload = {
        species_id: speciesId, enabled: enabledField(input.enabled),
        capacity_per_fish: numberField(input, 'capacity_per_fish', 1, 99, true),
        grow_seconds: numberField(input, 'grow_seconds', 61, 2147483647, true),
        seed_cash: numberField(input, 'seed_cash', 0, Number.MAX_SAFE_INTEGER, true),
        seed_weight_kg: numberField(input, 'seed_weight_kg', .0001, 99999999.9999),
        adult_weight_kg: numberField(input, 'adult_weight_kg', .0001, 99999999.9999),
        sale_cash_per_kg: numberField(input, 'sale_cash_per_kg', 0, 9999999999.99),
        rare_chance: numberField(input, 'rare_chance', 0, 1),
        advanced_rare_bonus: numberField(input, 'advanced_rare_bonus', 0, 1),
        rare_weight_multiplier: numberField(input, 'rare_weight_multiplier', 1, 10),
        feed_cooldown_seconds: numberField(input, 'feed_cooldown_seconds', 1800, 2147483647, true),
      }
      if (payload.adult_weight_kg <= payload.seed_weight_kg) throw new Error('Cân nặng trưởng thành phải lớn hơn cân nặng cá giống.')
      if (payload.rare_chance + payload.advanced_rare_bonus > 1) throw new Error('Tổng tỷ lệ đặc biệt và thưởng chăm chút không được vượt 1 (100%).')
      const row = current ? await repository.update(current.id, payload, current.rules_version) : await repository.create(payload)
      await this.fetchAll();
      return row
    },
    async remove(id: string) { await repository.remove(id); await this.fetchAll(); },
  },
})
