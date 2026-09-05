import supabase from "../database/connection";

class SupabaseFishingAreaRepository {
  async fetchAreas(): Promise<any[]> {
    const { data, error } = await supabase
      .from("fishing_areas")
      .select("id, country_id, x, y, title, location, scene_path")
      .eq("is_available", true)
      .order('y', {ascending: true});

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
    const { data, error } = await supabase
      .from("fishing_areas")
      .select("id, country_id, x, y, title, location, scene_path, fishing_boundary")
      .eq("id", areaId)
      .maybeSingle();

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
