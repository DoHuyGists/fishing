import type { LeaderboardCriterion, LeaderboardEntry } from "../types/model/leaderboard";
import supabase from "../database/connection";
import { supabaseAvatarRepository } from "./supabaseAvatarRepository";
import { pageRange, listPage } from './pagination';
import type { ListPage } from '../types/model/pagination';

class SupabaseLeaderboardRepository {
  private async withProfiles(entries: LeaderboardEntry[]): Promise<LeaderboardEntry[]> {
    if (!entries.length) return entries;
    const { data, error } = await supabase.from("user_profile").select("id,display_name,avatar_url,avatar_path").in("id", entries.map(entry => entry.id));
    if (error) throw new Error(error.message);
    const profiles = await supabaseAvatarRepository.resolveProfiles(data ?? []);
    const byId = new Map(profiles.map(profile => [profile.id, profile]));
    return entries.map(entry => ({ ...entry, display_name: byId.get(entry.id)?.display_name || entry.display_name, avatar_url: byId.get(entry.id)?.avatar_url ?? null }));
  }
  private metricColumn(criterion: LeaderboardCriterion) {
    return criterion === "best_fish" ? "best_fish->score" : criterion;
  }

  async fetchTop(page = 1, criterion: LeaderboardCriterion = "score"): Promise<ListPage<LeaderboardEntry>> {
    let query = supabase
      .from("leaderboard")
      .select("*", { count: 'exact' });
    if (criterion === "best_fish") query = query.not("best_fish->score", "is", null);
    const { data, error, count } = await query
      .order(this.metricColumn(criterion), { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: true })
      .order('id').range(...pageRange(page));

    if (error) throw new Error(error.message);
    return listPage(await this.withProfiles((data ?? []) as LeaderboardEntry[]), count);
  }

  async fetchByUser(userId: string): Promise<LeaderboardEntry | null> {
    const { data, error } = await supabase.from("leaderboard").select("*").eq("id", userId).maybeSingle();

    if (error) throw new Error(error.message);
    return data ? (await this.withProfiles([data as LeaderboardEntry]))[0]! : null;
  }

  async countHigher(value: number, criterion: LeaderboardCriterion): Promise<number> {
    const { count, error } = await supabase
      .from("leaderboard")
      .select("id", { count: "exact", head: true })
      .gt(this.metricColumn(criterion), value);

    if (error) throw new Error(error.message);
    return count ?? 0;
  }
}

export const supabaseLeaderboardRepository = new SupabaseLeaderboardRepository();
