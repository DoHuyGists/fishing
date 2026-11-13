import type { SpeciesRow } from "../../../types/table/species";
import type { AdminItemRow } from "../../../types/table/item";
import type { AquacultureFoodRow, AquacultureRuleRow } from "../../../types/table/aquacultureAdmin";
import { defineStore } from 'pinia'
import { supabaseSpeciesRepository } from '../../../data/supabaseSpeciesRepository';
import { supabaseItemRepository } from '../../../data/supabaseItemRepository';
import { supabaseAquacultureFoodsAdminRepository as repository, supabaseAquacultureRulesAdminRepository } from '../../../data/supabaseAquacultureAdminRepository';
import { enabledField, numberField } from '../aquaculture-species-management/admin-aquaculture-species-store'

export const useAdminAquacultureFoodStore = defineStore('AdminAquacultureFood', {
  state: () => ({
    items: [] as AquacultureFoodRow[], species: [] as SpeciesRow[], rules: [] as AquacultureRuleRow[],
    sourceItems: [] as AdminItemRow[], loading: false, error: '',
    page: 1, pageSize: 10, total: 0, search: '', requestId: 0,
  }),
  actions: {
    async fetchAll(page?: number, search?: string) {
      page ??= this.page; this.search = search ?? this.search;
      const request = ++this.requestId;
      this.loading = true; this.error = ''
      try {
        const [result, species, rules, items] = await Promise.all([
          repository.fetchPage(page, this.search),
          this.species.length ? Promise.resolve(this.species) : supabaseSpeciesRepository.fetchAll(),
          this.rules.length ? Promise.resolve(this.rules) : supabaseAquacultureRulesAdminRepository.fetchAll(),
          this.sourceItems.length ? Promise.resolve(this.sourceItems) : supabaseItemRepository.fetchAll(),
        ]);
        if (request !== this.requestId) return;
        this.items = result.items; this.species = species; this.rules = rules; this.sourceItems = items;
        this.page = page; this.total = result.total;
        if (!result.items.length && page > 1) await this.fetchAll(Math.max(1, Math.ceil(result.total / this.pageSize)));
      } catch (error) { if (request === this.requestId) this.error = error instanceof Error ? error.message : 'Không tải được thức ăn cho cá.' }
      finally { if (request === this.requestId) this.loading = false }
    },
    async save(input: Record<string, unknown>, id: string | null) {
      const current = id ? this.items.find(r => r.id === id) : null
      if (id && !current) throw new Error('Cấu hình không còn tồn tại. Hãy tải lại.')
      const payload = {
        species_id: current?.species_id ?? String(input.species_id ?? ''),
        item_id: current?.item_id ?? String(input.item_id ?? ''),
        enabled: enabledField(input.enabled),
        capacity_units_per_item: numberField(input, 'capacity_units_per_item', 1, 2147483647, true),
        quality_gain: numberField(input, 'quality_gain', .001, 1),
      }
      if (!this.rules.some(r => r.species_id === payload.species_id)) throw new Error('Loài cần có cấu hình nuôi trước khi thêm thức ăn.')
      if (!this.sourceItems.some(i => i.id === payload.item_id)) throw new Error('Hãy chọn vật phẩm thức ăn hợp lệ.')
      if (!current && this.items.some(r => r.species_id === payload.species_id && r.item_id === payload.item_id)) {
        throw new Error('Vật phẩm này đã được cấu hình cho loài đã chọn. Hãy sửa cấu hình hiện có.')
      }
      const row = current ? await repository.update(payload) : await repository.create(payload)
      await this.fetchAll();
      return row
    },
    async remove(id: string) {
      const row = this.items.find(r => r.id === id)
      if (!row) throw new Error('Không tìm thấy cấu hình thức ăn.')
      await repository.remove(row.species_id, row.item_id)
      await this.fetchAll();
    },
  },
})
