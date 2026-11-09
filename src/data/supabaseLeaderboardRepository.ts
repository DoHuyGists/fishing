import supabase from "../database/connection";
import { supabaseAvatarRepository } from "./supabaseAvatarRepository";

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
  score: number;
  created_at: string;
  updated_at: string;
}

class SupabaseLeaderboardRepository {
  private async withProfiles(entries: LeaderboardEntry[]): Promise<LeaderboardEntry[]> {
    if (!entries.length) return entries;
    const { data, error } = await supabase.from("user_profile").select("id,display_name,avatar_url,avatar_path").in("id", entries.map(entry => entry.user_id));
    if (error) throw new Error(error.message);
    const profiles = await supabaseAvatarRepository.resolveProfiles(data ?? []);
    const byId = new Map(profiles.map(profile => [profile.id, profile]));
    return entries.map(entry => ({ ...entry, display_name: byId.get(entry.user_id)?.display_name || entry.display_name, avatar_url: byId.get(entry.user_id)?.avatar_url ?? null }));
  }
  async fetchTop(limit = 50): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("*")
      .order("score", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);
    return this.withProfiles((data ?? []) as LeaderboardEntry[]);
  }

  async fetchByUser(userId: string): Promise<LeaderboardEntry | null> {
    const { data, error } = await supabase.from("leaderboard").select("*").eq("user_id", userId).maybeSingle();

    if (error) throw new Error(error.message);
    return data ? (await this.withProfiles([data as LeaderboardEntry]))[0]! : null;
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
