import supabase from "../database/connection";

export type FactionEffectType = "BUFF" | "DEBUFF" | "UNIQUE";

export interface FactionEffect {
  id: string;
  faction_id: string;
  effect_type: FactionEffectType;
  code: string;
  name: string;
  description: string | null;
  target_stat: string;
  config: Record<string, unknown>;
  is_enabled: boolean;
  created_at: string;
}

export interface Faction {
  id: string;
  code: string;
  name: string;
  symbol: string;
  element: string | null;
  description: string | null;
  is_neutral: boolean;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  faction_effects?: FactionEffect[];
}

export interface CurrentFactionEffect {
  id?: string;
  faction_id?: string;
  effect_type: FactionEffectType;
  code: string;
  name: string;
  description: string | null;
  target_stat: string;
  config?: Record<string, unknown>;
  is_enabled?: boolean;
}

export interface FactionDailyActivity {
  user_id?: string;
  activity_date?: string;
  qualifying_actions: number;
  faction_id?: string;
  created_at?: string;
  updated_at?: string;
}


class SupabaseFactionRepository {
  /**
   * Lấy danh sách tất cả các phe kèm danh sách hiệu ứng được kích hoạt.
   */
  async fetchFactions(): Promise<Faction[]> {
    const { data, error } = await supabase
      .from("factions")
      .select("*, faction_effects(*)")
      .eq("is_enabled", true)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as Faction[];
  }

  /**
   * Lấy ID phe hiện tại của người chơi từ bảng user_factions (nếu có).
   */
  async fetchUserFactionId(userId: string): Promise<string | null> {
    if (!userId) return null;

    const { data, error } = await supabase
      .from("user_factions")
      .select("faction_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return null;
    }

    return (data as { faction_id: string } | null)?.faction_id ?? null;
  }

  /**
   * Lấy danh sách hiệu ứng đang được áp dụng cho người chơi sau khi đã gia nhập phe.
   */
  async getCurrentFactionEffects(): Promise<CurrentFactionEffect[]> {
    const { data, error } = await supabase.rpc("get_current_faction_effects");

    if (error) {
      return [];
    }

    return (data ?? []) as CurrentFactionEffect[];
  }

  /**
   * Tham gia phe mới qua RPC join_faction.
   */
  async joinFaction(factionId: string): Promise<void> {
    const { error } = await supabase.rpc("join_faction", {
      p_faction_id: factionId,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Chuyển phe qua RPC change_faction.
   */
  async changeFaction(factionId: string): Promise<void> {
    const { error } = await supabase.rpc("change_faction", {
      p_faction_id: factionId,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Lấy điểm năng động hàng ngày (qualifying_actions) của người chơi qua RPC get_my_faction_daily_activity.
   */
  async getMyFactionDailyActivity(): Promise<number> {
    const { data, error } = await supabase.rpc("get_my_faction_daily_activity");

    if (error) {
      return 0;
    }

    if (typeof data === "number") {
      return Math.max(0, data);
    }

    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0] as Record<string, unknown>;
      return Math.max(0, Number(firstItem?.qualifying_actions ?? 0));
    }

    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      return Math.max(0, Number(record.qualifying_actions ?? 0));
    }

    return 0;
  }

  /**
   * Đếm số lượng thành viên của mỗi phe từ bảng user_factions.
   * Trả về Record<string, number> ánh xạ faction_id -> số lượng thành viên.
   */
  async fetchFactionMemberCounts(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from("user_factions")
      .select("faction_id");

    if (error) {
      throw new Error(`Không thể lấy số lượng thành viên phe: ${error.message}`);
    }

    if (!data) return {};

    return data.reduce<Record<string, number>>((acc, row) => {
      const id = (row as { faction_id: string | null }).faction_id;
      if (!id) return acc;
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
  }
}

export const supabaseFactionRepository = new SupabaseFactionRepository();
