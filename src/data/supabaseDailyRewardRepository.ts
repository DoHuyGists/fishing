import supabase from "../database/connection";

export interface DailyRewardPreview {
  id: string;
  name: string;
  image: string | null;
  icon: string | null;
}

interface DailyRewardRow {
  id: string;
  item: Omit<DailyRewardPreview, "id">;
}

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
