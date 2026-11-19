import type { BadgeListPage, BadgeStatusFilter } from "../types/model/badge";
import supabase from "../database/connection";

class SupabaseBadgeRepository {
  async fetchPage(page: number, search: string, type: string, status: BadgeStatusFilter): Promise<BadgeListPage> {
    const { data, error } = await supabase.rpc("get_user_badges_page", {
      p_page: page,
      p_search: search.trim(),
      p_type: type,
      p_status: status,
    });
    if (error) throw new Error(error.message);
    return data as BadgeListPage;
  }

  async claimBadgeReward(badgeId: string): Promise<void> {
    const { error } = await supabase.rpc("claim_badge_reward", { p_badge_id: badgeId });
    if (error) throw new Error(error.message);
  }
}

export const supabaseBadgeRepository = new SupabaseBadgeRepository();
