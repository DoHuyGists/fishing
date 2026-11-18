import type { AreaSpecies } from "../types/model/speciesInArea";
import type { SpeciesInAreaRow, SpeciesInAreaPayload, SpeciesInAreaWeightUpdate } from "../types/table/speciesInArea";
import supabase from "../database/connection";
import { fetchAdminListPage } from './supabaseAdminListRepository';
import { readCatalogPages } from './readCatalogPages';


const SELECT_QUERY = "*, area:fishing_areas(id, title, country_id), species:species(id, name, image, rarity)";

function mapRow(row: any): SpeciesInAreaRow {
  return {
    id: row.id,
    areaId: row.area_id,
    speciesId: row.species_id,
    depthScopeId: row.depth_scope_id ?? null,
    weightRate: row.weight_rate,
    boundary: row.boundary ?? null,
    areaTitle: row.area?.title ?? null,
    areaCountryId: row.area?.country_id ?? null,
    speciesName: row.species?.name ?? null,
    speciesImage: row.species?.image ?? null,
    speciesRarity: row.species?.rarity ?? null,
  };
}

class SupabaseSpeciesInAreaRepository {
  async fetchDistribution(areaId: string): Promise<SpeciesInAreaRow[]> {
    // Do not let either the admin page size or PostgREST's row limit truncate a lake.
    const rows = await readCatalogPages((from, to) => supabase.from("species_in_area").select(SELECT_QUERY)
      .eq("area_id", areaId).order("species_id").range(from, to));
    return rows.map(mapRow);
  }

  async updateDistribution(areaId: string, weights: SpeciesInAreaWeightUpdate[]): Promise<void> {
    const { error } = await supabase.rpc("update_species_in_area_distribution", {
      p_area_id: areaId,
      p_boundary: weights[0]?.boundary,
      p_weights: weights.map(item => ({
        species_id: item.speciesId, weight_rate: item.weightRate, previous_weight_rate: item.previousWeightRate,
        boundary: item.boundary, previous_boundary: item.previousBoundary,
      })),
    });
    if (error) {
      if (error.code === '40001') throw new Error('Cấu hình bãi câu đã thay đổi. Hãy tải lại phân bổ trước khi chỉnh sửa tiếp.');
      if (error.code === 'PGRST202') throw new Error('Cần chạy migration 20261118_species_distribution_boundary.sql trên Supabase để lưu phân bổ và vòng biên.');
      throw new Error(error.message);
    }
  }

  async fetchPage(page: number, search: string, area: string, species: string) {
    const result = await fetchAdminListPage<any>('species_in_area', page, search, {
      ...(area === 'ALL' ? {} : { area_id: area }), ...(species === 'ALL' ? {} : { species_id: species }),
    });
    return { ...result, items: result.items.map(mapRow) };
  }
  async fetchSpeciesByAreaId(areaId: string): Promise<AreaSpecies[]> {
    const { data, error } = await supabase
      .from("species_in_area")
      .select("species:species!inner(id, name, image, rarity, information, weight_min, weight_max)")
      .eq("area_id", areaId);

    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as { species: AreaSpecies }[];
    return rows.map((row) => row.species);
  }

  async fetchAll(): Promise<SpeciesInAreaRow[]> {
    const { data, error } = await supabase.from("species_in_area").select(SELECT_QUERY).order("weight_rate", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  }

  async create(payload: SpeciesInAreaPayload): Promise<SpeciesInAreaRow> {
    const { data, error } = await supabase.from("species_in_area").insert({ area_id: payload.areaId, species_id: payload.speciesId, weight_rate: payload.weightRate, depth_scope_id: payload.depthScopeId }).select(SELECT_QUERY).single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async update(areaId: string, speciesId: string, payload: SpeciesInAreaPayload): Promise<SpeciesInAreaRow> {
    const { data, error } = await supabase.from("species_in_area").update({ area_id: payload.areaId, species_id: payload.speciesId, weight_rate: payload.weightRate, depth_scope_id: payload.depthScopeId }).eq("area_id", areaId).eq("species_id", speciesId).select(SELECT_QUERY).single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async delete(areaId: string, speciesId: string): Promise<void> {
    const { error } = await supabase.from("species_in_area").delete().eq("area_id", areaId).eq("species_id", speciesId);
    if (error) throw new Error(error.message);
  }
}

export const supabaseSpeciesInAreaRepository = new SupabaseSpeciesInAreaRepository();
