import supabase from "../database/connection";

class SupabaseFishRepository {
  async fetchFishesByArea(areaId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("fishes_in_area")
      .select("id, area_id, fishes")
      .eq("area_id", areaId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) return [];

    return data.fishes ?? [];
  }
}

export const supabaseFishRepository = new SupabaseFishRepository();
