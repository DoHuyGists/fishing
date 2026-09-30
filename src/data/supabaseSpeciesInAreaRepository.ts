import supabase from "../database/connection";

export interface SpeciesInAreaRow {
  id: string;
  areaId: string;
  speciesId: string;
  weightRate: number;
  areaTitle: string | null;
  areaCountryId: string | null;
  speciesName: string | null;
  speciesRarity: string | null;
}

export interface SpeciesInAreaPayload {
  areaId: string;
  speciesId: string;
  weightRate: number;
}

const SELECT_QUERY = "*, area:fishing_areas(id, title, country_id), species:species(id, name, rarity)";

function mapRow(row: any): SpeciesInAreaRow {
  return {
    id: row.id,
    areaId: row.area_id,
    speciesId: row.species_id,
    weightRate: row.weight_rate,
    areaTitle: row.area?.title ?? null,
    areaCountryId: row.area?.country_id ?? null,
    speciesName: row.species?.name ?? null,
    speciesRarity: row.species?.rarity ?? null,
  };
}

class SupabaseSpeciesInAreaRepository {
  async fetchAll(): Promise<SpeciesInAreaRow[]> {
    const { data, error } = await supabase.from("species_in_area").select(SELECT_QUERY).order("weight_rate", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  }

  async create(payload: SpeciesInAreaPayload): Promise<SpeciesInAreaRow> {
    const { data, error } = await supabase.from("species_in_area").insert({ area_id: payload.areaId, species_id: payload.speciesId, weight_rate: payload.weightRate }).select(SELECT_QUERY).single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async update(areaId: string, speciesId: string, payload: SpeciesInAreaPayload): Promise<SpeciesInAreaRow> {
    const { data, error } = await supabase.from("species_in_area").update({ area_id: payload.areaId, species_id: payload.speciesId, weight_rate: payload.weightRate }).eq("area_id", areaId).eq("species_id", speciesId).select(SELECT_QUERY).single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async delete(areaId: string, speciesId: string): Promise<void> {
    const { error } = await supabase.from("species_in_area").delete().eq("area_id", areaId).eq("species_id", speciesId);
    if (error) throw new Error(error.message);
  }
}

export const supabaseSpeciesInAreaRepository = new SupabaseSpeciesInAreaRepository();
