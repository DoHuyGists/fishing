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
