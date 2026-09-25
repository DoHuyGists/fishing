import supabase from "../database/connection";
import type { Fish } from "./fishingLogic";

export type CaughtRow = {
  id: string;
  created_at: string;
  user_id: string;
  area_id: string;
  fish: Fish;
  status?: string;
};

class SupabaseFishRepository {
  async fetchFishesByArea(areaId: string): Promise<Fish[]> {
    const { data, error } = await supabase
      .from("species_in_area")
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
      .select("id, created_at, user_id, area_id, fish, status")
      .eq("user_id", userId)
      .eq("area_id", areaId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).filter((row) => row.status !== "on-market");
  }

  async fetchAllCaughtFishes(userId: string): Promise<CaughtRow[]> {
    const { data, error } = await supabase
      .from("caught")
      .select("id, created_at, user_id, area_id, fish, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).filter((row) => row.status !== "on-market");
  }

  async deleteCaughtFish(caughtId: string): Promise<void> {
    const { error } = await supabase.from("caught").delete().eq("id", caughtId);

    if (error) throw new Error(error.message);
  }

  async listFishOnMarket(caughtId: string, userId: string, price: number): Promise<void> {
    const { error: marketError } = await supabase.from("market").insert({
      item_id: caughtId,
      user_id: userId,
      price: price,
      status: "normal",
    });

    if (marketError) throw new Error(marketError.message);

    const { data: updatedRows, error: caughtError } = await supabase
      .from("caught")
      .update({ status: "on-market" })
      .eq("id", caughtId)
      .select();

    if (caughtError) throw new Error(caughtError.message);

    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(
        "Không thể cập nhật trạng thái cá (0 dòng bị ảnh hưởng). Vui lòng kiểm tra lại RLS (Row Level Security) Policy cho thao tác UPDATE trên bảng 'caught'."
      );
    }
  }
}

export const supabaseFishRepository = new SupabaseFishRepository();


