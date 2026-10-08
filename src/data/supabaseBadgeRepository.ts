import supabase from "../database/connection";

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
}

export interface UserBadge {
  badge_id: string;
  quantity: number;
  earned_at: string;
}

class SupabaseBadgeRepository {
  async fetchBadges(): Promise<Badge[]> {
    const { data, error } = await supabase
      .from("badges")
      .select("id, name, description, icon_url")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async fetchUserBadges(userId: string): Promise<UserBadge[]> {
    if (!userId) return [];
    const { data, error } = await supabase
      .from("user_badges")
      .select("badge_id, quantity, earned_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  }
}

export const supabaseBadgeRepository = new SupabaseBadgeRepository();
