import supabase from "../database/connection";

export interface FishingAreaRow {
  id: string;
  createdAt: string;
  countryId: string;
  isAvailable: boolean;
  title: string | null;
  location: any;
  scenePath: string | null;
  fishingBoundary: any[];
  zoneId: string | null;
  maxDepth: number | null;
}

export interface FishingAreaPayload {
  countryId: string;
  isAvailable: boolean;
  title: string | null;
  location: any;
  scenePath: string | null;
  fishingBoundary: any[];
  zoneId: string | null;
  maxDepth: number | null;
}

function mapRow(row: any): FishingAreaRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    countryId: row.country_id,
    isAvailable: row.is_available,
    title: row.title,
    location: row.location,
    scenePath: row.scene_path,
    fishingBoundary: row.fishing_boundary ?? [],
    zoneId: row.zone_id ?? null,
    maxDepth: row.max_depth == null ? null : Number(row.max_depth),
  };
}

function toDbPayload(payload: FishingAreaPayload) {
  return {
    country_id: payload.countryId,
    is_available: payload.isAvailable,
    title: payload.title,
    location: payload.location,
    scene_path: payload.scenePath,
    fishing_boundary: payload.fishingBoundary,
    zone_id: payload.zoneId,
    max_depth: payload.maxDepth,
  };
}

class SupabaseFishingAreaRepository {
  async fetchAllAreasAdmin(): Promise<FishingAreaRow[]> {
    const { data, error } = await supabase.from("fishing_areas").select("*").order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    if (!data) return [];

    return data.map(mapRow);
  }

  async createArea(payload: FishingAreaPayload): Promise<FishingAreaRow> {
    const { data, error } = await supabase.from("fishing_areas").insert(toDbPayload(payload)).select("*").single();

    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async updateArea(id: string, payload: FishingAreaPayload): Promise<FishingAreaRow> {
    const { data, error } = await supabase.from("fishing_areas").update(toDbPayload(payload)).eq("id", id).select("*").single();

    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async deleteArea(id: string): Promise<void> {
    const { error } = await supabase.from("fishing_areas").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
  async fetchAreas(): Promise<any[]> {
    const { data, error } = await supabase.from("fishing_areas").select("id, country_id, title, location, scene_path").eq("is_available", true);

    if (error) throw new Error(error.message);

    if (!data) return [];

    return data.map((x) => ({
      id: x.id,
      title: x.title,
      countryId: x.country_id,
      location: x.location,
      scenePath: x.scene_path,
    }));
  }
  async fetchOneAreas(areaId: string): Promise<any> {
    const { data, error } = await supabase.from("fishing_areas").select("id, country_id, title, location, scene_path, fishing_boundary, max_depth").eq("id", areaId).maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) return null;

    return {
      id: data.id,
      title: data.title,
      countryId: data.country_id,
      location: data.location,
      scenePath: data.scene_path,
      fishingBoundary: data.fishing_boundary,
      maxDepth: data.max_depth == null ? null : Number(data.max_depth),
    };
  }
}

export const supabaseFishingAreaRepository = new SupabaseFishingAreaRepository();
