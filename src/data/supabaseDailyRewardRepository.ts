import type { DailyRewardPreview } from "../types/model/dailyReward";
import type { DailyRewardRow } from "../types/table/dailyReward";
import supabase from "../database/connection";

class SupabaseDailyRewardRepository {
  async fetchRewards(): Promise<DailyRewardPreview[]> {
    const { data, error } = await supabase
      .from("daily_rewards")
      .select("id,item:items!daily_rewards_item_id_fkey!inner(name,image,icon)")
      .order("created_at", { ascending: false })
      .order("id")
      .returns<DailyRewardRow[]>();

    if (error) throw new Error(error.message);
    return (data ?? []).map(({ id, item }) => ({ id, ...item }));
  }
}

export const supabaseDailyRewardRepository = new SupabaseDailyRewardRepository();
