import supabase from "../database/connection";

export interface UserBadgeStatus {
  badge_id: string;
  name: string;
  description: string | null;
  icon_url?: string | null;
  type: string | null;
  reward: Record<string, number> | null;
  is_earned: boolean;
  quantity: number;
  earned_at: string | null;
  is_claim: boolean;
  can_claim: boolean;
}

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
