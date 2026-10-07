import supabase from "../database/connection";

export interface FishingAreaRow {
  id: string;
  createdAt: string;
  countryId: string;
  isAvailable: boolean;
  x: number;
  y: number;
  title: string | null;
  location: any;
  scenePath: string | null;
  fishingBoundary: any[] | string;
}

export interface FishingAreaPayload {
  countryId: string;
  isAvailable: boolean;
  x: number;
  y: number;
  title: string | null;
  location: any;
  scenePath: string | null;
  fishingBoundary: any[];
}

function mapRow(row: any): FishingAreaRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    countryId: row.country_id,
    isAvailable: row.is_available,
    x: row.x,
    y: row.y,
    title: row.title,
    location: row.location,
    scenePath: row.scene_path,
    fishingBoundary: row.fishing_boundary ?? [],
  };
}

function toDbPayload(payload: FishingAreaPayload) {
  return {
    country_id: payload.countryId,
    is_available: payload.isAvailable,
    x: payload.x,
    y: payload.y,
    title: payload.title,
    location: payload.location,
    scene_path: payload.scenePath,
    fishing_boundary: payload.fishingBoundary,
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
    const { data, error } = await supabase.from("fishing_areas").select("id, country_id, x, y, title, location, scene_path").eq("is_available", true).order("y", { ascending: true });

    if (error) throw new Error(error.message);

    if (!data) return [];

    return data.map((x) => ({
      id: x.id,
      x: x.x,
      y: x.y,
      title: x.title,
      countryId: x.country_id,
      location: x.location,
      scenePath: x.scene_path,
    }));
  }
  async fetchOneAreas(areaId: string): Promise<any> {
    const { data, error } = await supabase.from("fishing_areas").select("id, country_id, x, y, title, location, scene_path, fishing_boundary").eq("id", areaId).maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) return null;

    return {
      id: data.id,
      x: data.x,
      y: data.y,
      title: data.title,
      countryId: data.country_id,
      location: data.location,
      scenePath: data.scene_path,
      fishingBoundary: data.fishing_boundary,
    };
  }
}

export const supabaseFishingAreaRepository = new SupabaseFishingAreaRepository();
