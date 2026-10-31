import supabase from "../database/connection";

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  display_name: string | null;
  score: number;
  created_at: string;
  updated_at: string;
}

class SupabaseLeaderboardRepository {
  async fetchTop(limit = 50): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("*")
      .order("score", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data ?? []) as LeaderboardEntry[];
  }

  async fetchByUser(userId: string): Promise<LeaderboardEntry | null> {
    const { data, error } = await supabase.from("leaderboard").select("*").eq("user_id", userId).maybeSingle();

    if (error) throw new Error(error.message);
    return data as LeaderboardEntry | null;
  }

  async countHigherScore(score: number): Promise<number> {
    const { count, error } = await supabase
      .from("leaderboard")
      .select("id", { count: "exact", head: true })
      .gt("score", score);

    if (error) throw new Error(error.message);
    return count ?? 0;
  }
}

export const supabaseLeaderboardRepository = new SupabaseLeaderboardRepository();
