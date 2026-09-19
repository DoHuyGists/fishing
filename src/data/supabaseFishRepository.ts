import supabase from "../database/connection";
import type { Fish } from "./fishingLogic";

export type CaughtRow = {
  id: string;
  created_at: string;
  user_id: string;
  area_id: string;
  fish: Fish;
};

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

  async fetchCaughtFishes(userId: string, areaId: string): Promise<CaughtRow[]> {
    const { data, error } = await supabase
      .from("caught")
      .select("id, created_at, user_id, area_id, fish")
      .eq("user_id", userId)
      .eq("area_id", areaId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return data ?? [];
  }

  async fetchAllCaughtFishes(userId: string): Promise<CaughtRow[]> {
    const { data, error } = await supabase
      .from("caught")
      .select("id, created_at, user_id, area_id, fish")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return data ?? [];
  }

  async deleteCaughtFish(caughtId: string): Promise<void> {
    const { error } = await supabase.from("caught").delete().eq("id", caughtId);

    if (error) throw new Error(error.message);
  }
}

export const supabaseFishRepository = new SupabaseFishRepository();


