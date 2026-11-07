import supabase from '../database/connection'
import type { AquacultureRules } from './aquaculture'

export type AquacultureRuleRow = AquacultureRules & { id: string; updated_at: string }
export type AquacultureRulePayload = Omit<AquacultureRules, 'rules_version'>
export interface AquacultureFoodPayload {
  species_id: string
  item_id: string
  enabled: boolean
  capacity_units_per_item: number
  quality_gain: number
}
export type AquacultureFoodRow = AquacultureFoodPayload & { id: string }
const ruleRow = (r: any): AquacultureRuleRow => ({ ...r, id: r.species_id })
const foodRow = (r: any): AquacultureFoodRow => ({ ...r, id: r.species_id + ':' + r.item_id })

export const supabaseAquacultureRulesAdminRepository = {
  async fetchAll(): Promise<AquacultureRuleRow[]> {
    const { data, error } = await supabase.from('aquaculture_species_rules').select('*').order('species_id')
    if (error) throw new Error(error.message)
    return (data ?? []).map(ruleRow)
  },
  async create(payload: AquacultureRulePayload): Promise<AquacultureRuleRow> {
    const { data, error } = await supabase.from('aquaculture_species_rules').insert(payload).select('*').single()
    if (error) throw new Error(error.message)
    return ruleRow(data)
  },
  async update(id: string, payload: AquacultureRulePayload, version: number): Promise<AquacultureRuleRow> {
    const { data, error } = await supabase.from('aquaculture_species_rules')
      .update({ ...payload, rules_version: version + 1, updated_at: new Date().toISOString() })
      .eq('species_id', id).eq('rules_version', version).select('*').maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Cấu hình đã thay đổi ở phiên khác. Hãy làm mới trước khi sửa tiếp.')
    return ruleRow(data)
  },
  async remove(id: string): Promise<void> {
    const { data, error } = await supabase.from('aquaculture_species_rules').delete().eq('species_id', id).select('species_id')
    if (error) throw new Error(error.code === '23503' ? 'Loài đã có thức ăn hoặc lịch sử nuôi. Hãy tắt loài thay vì xoá.' : error.message)
    if (!data?.length) throw new Error('Không xoá được cấu hình. Kiểm tra quyền admin hoặc tải lại dữ liệu.')
  },
}

export const supabaseAquacultureFoodsAdminRepository = {
  async fetchAll(): Promise<AquacultureFoodRow[]> {
    const { data, error } = await supabase.from('aquaculture_species_foods').select('*').order('species_id').order('item_id')
    if (error) throw new Error(error.message)
    return (data ?? []).map(foodRow)
  },
  async create(payload: AquacultureFoodPayload): Promise<AquacultureFoodRow> {
    const { data, error } = await supabase.from('aquaculture_species_foods').insert(payload).select('*').single()
    if (error) throw new Error(error.message)
    return foodRow(data)
  },
  async update(payload: AquacultureFoodPayload): Promise<AquacultureFoodRow> {
    const { data, error } = await supabase.from('aquaculture_species_foods').update(payload)
      .eq('species_id', payload.species_id).eq('item_id', payload.item_id).select('*').single()
    if (error) throw new Error(error.message)
    return foodRow(data)
  },
  async remove(speciesId: string, itemId: string): Promise<void> {
    const { data, error } = await supabase.from('aquaculture_species_foods').delete()
      .eq('species_id', speciesId).eq('item_id', itemId).select('species_id')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Error('Không xoá được thức ăn. Kiểm tra quyền admin hoặc tải lại dữ liệu.')
  },
}
