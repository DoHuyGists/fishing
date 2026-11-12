import type { AreaSpecies } from "../types/model/speciesInArea";
import type { SpeciesInAreaRow, SpeciesInAreaPayload } from "../types/table/speciesInArea";
import supabase from "../database/connection";


const SELECT_QUERY = "*, area:fishing_areas(id, title, country_id), species:species(id, name, image, rarity)";

function mapRow(row: any): SpeciesInAreaRow {
  return {
    id: row.id,
    areaId: row.area_id,
    speciesId: row.species_id,
    depthScopeId: row.depth_scope_id ?? null,
    weightRate: row.weight_rate,
    areaTitle: row.area?.title ?? null,
    areaCountryId: row.area?.country_id ?? null,
    speciesName: row.species?.name ?? null,
    speciesImage: row.species?.image ?? null,
    speciesRarity: row.species?.rarity ?? null,
  };
}

class SupabaseSpeciesInAreaRepository {
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
