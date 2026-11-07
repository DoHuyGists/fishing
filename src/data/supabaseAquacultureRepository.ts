import supabase from '../database/connection'
import type { AquacultureCatalog, AquacultureFarm, AquacultureRecord, FarmAction, FarmActionResult } from './aquaculture'

export class AquacultureRpcError extends Error {
  readonly uncertain: boolean
  constructor(message: string, uncertain: boolean) { super(message); this.uncertain = uncertain }
}

class SupabaseAquacultureRepository {
  async fetchFarm(): Promise<AquacultureFarm> {
    const { data, error } = await supabase.rpc('get_aquaculture_farm')
    if (error) throw new Error(error.message)
    if (!data || !Array.isArray(data.ponds) || !Array.isArray(data.species)) {
      throw new Error('Dữ liệu nông trại không hợp lệ. Vui lòng kiểm tra RPC get_aquaculture_farm.')
    }
    return data as AquacultureFarm
  }
  async fetchCatalog(): Promise<AquacultureCatalog> {
    const [species, foods] = await Promise.all([
      supabase.from('aquaculture_species_rules').select('species_id, species(id, name, image)'),
      supabase.from('aquaculture_species_foods').select('*, items(id, name, isDisabled)'),
    ])
    if (species.error) throw new Error(species.error.message)
    if (foods.error) throw new Error(foods.error.message)
    const one = (relation: any) => Array.isArray(relation) ? relation[0] : relation
    return {
      species: (species.data ?? []).map((row: any) => one(row.species)).filter(Boolean),
      foods: (foods.data ?? []).map((row: any) => ({ ...row, item: one(row.items) ?? null })),
    }
  }
  async fetchRecords(userId: string): Promise<AquacultureRecord[]> {
    const { data, error } = await supabase.from('aquaculture_records').select('*').eq('user_id', userId)
    if (error) throw new Error(error.message)
    return (data ?? []) as AquacultureRecord[]
  }
  async fetchStoredFishCount(userId: string): Promise<number> {
    const { count, error } = await supabase.from('caught').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'normal')
    if (error) throw new Error(error.message)
    return count ?? 0
  }
  async execute(action: FarmAction, params: Record<string, unknown>, requestId: string): Promise<FarmActionResult> {
    const { data, error } = await supabase.rpc(action, { ...params, p_request_id: requestId })
    // A lost response may follow a committed transaction. Keep the request ID for a safe retry.
    if (error) throw new AquacultureRpcError(error.message, !error.code || error.code === 'PGRST002')
    return (data ?? {}) as FarmActionResult
  }
}
export const supabaseAquacultureRepository = new SupabaseAquacultureRepository()
