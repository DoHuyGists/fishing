import { RepositoryError } from './repositoryError';
import { readCatalogPages } from './readCatalogPages';
import type { AquacultureCatalog, AquacultureFarm, FarmAction, FarmActionResult } from "../types/model/aquaculture";
import type { AquacultureRecord } from "../types/table/aquaculture";
import { t as tr } from "../i18n";
import supabase from '../database/connection'


export class AquacultureRpcError extends Error {
  readonly uncertain: boolean
  constructor(message: string, uncertain: boolean) { super(message); this.uncertain = uncertain }
}

class SupabaseAquacultureRepository {
  async fetchFarm(): Promise<AquacultureFarm> {
    const { data, error } = await supabase.rpc('get_aquaculture_farm')
    if (error) throw new RepositoryError(error)
    if (!data || !Array.isArray(data.ponds) || !Array.isArray(data.species)) {
      throw new Error(tr('supabaseAquacultureRepository.du_lieu_nong_trai_khong_hop_le_vui_long_kiem_tra_rpc_get_aquacul'))
    }
    return data as AquacultureFarm
  }
  async fetchCatalog(signal?: AbortSignal): Promise<AquacultureCatalog> {
    const [species, foods] = await Promise.all([
      readCatalogPages((from, to) => supabase.from('aquaculture_species_rules').select('species_id, species(id, name, image)').order('species_id').range(from, to).abortSignal(signal ?? new AbortController().signal)),
      readCatalogPages((from, to) => supabase.from('aquaculture_species_foods').select('*, items(id, name, isDisabled)').order('species_id').order('item_id').range(from, to).abortSignal(signal ?? new AbortController().signal)),
    ])
    const one = (relation: any) => Array.isArray(relation) ? relation[0] : relation
    return {
      species: species.map((row: any) => one(row.species)).filter(Boolean),
      foods: foods.map((row: any) => ({ ...row, item: one(row.items) ?? null })),
    }
  }
  async fetchRecords(userId: string): Promise<AquacultureRecord[]> {
    const { data, error } = await supabase.from('aquaculture_records').select('*').eq('user_id', userId)
    if (error) throw new RepositoryError(error)
    return (data ?? []) as AquacultureRecord[]
  }
  async fetchStoredFishCount(userId: string): Promise<number> {
    const { count, error } = await supabase.from('caught').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'normal')
    if (error) throw new RepositoryError(error)
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
