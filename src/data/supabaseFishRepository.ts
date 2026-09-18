import supabase from "../database/connection";
import type { Fish } from "./fishingLogic";

class SupabaseFishRepository {
  async fetchFishesByArea(areaId: string): Promise<Fish[]> {
    const { data, error } = await supabase
      .from("fishes_in_area")
      .select("id, area_id, fishes")
      .eq("area_id", areaId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) return [];

    return data.fishes ?? [];
  }

  async saveCaughtFish(userId: string, areaId: string, fish: Fish): Promise<void> {
    const { error } = await supabase.from("caught").insert({
      user_id: userId,
      area_id: areaId,
      fish: fish,
    });

    if (error) throw new Error(error.message);
  }
}

export const supabaseFishRepository = new SupabaseFishRepository();

