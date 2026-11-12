import type { UserBadgeStatus } from "../types/model/badge";
import supabase from "../database/connection";

class SupabaseBadgeRepository {
  async fetchUserBadgesStatus(): Promise<UserBadgeStatus[]> {
    const { data, error } = await supabase.rpc("get_user_badges_status");
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async claimBadgeReward(badgeId: string): Promise<void> {
    const { error } = await supabase.rpc("claim_badge_reward", { p_badge_id: badgeId });
    if (error) throw new Error(error.message);
  }
}

export const supabaseBadgeRepository = new SupabaseBadgeRepository();
