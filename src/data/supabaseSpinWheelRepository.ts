import supabase from "../database/connection";

export interface SpinWheelItem {
  id: string;
  name: string;
  category: string;
  image: string | null;
  information: string | null;
}

export interface SpinWheelSeasonRewards {
  season: { id: string; name: string; starts_at: string; ends_at: string } | null;
  rewards: SpinWheelItem[];
}

export interface SpinWheelResult extends SpinWheelSeasonRewards {
  item_id: string;
  inventory_id: string;
  cost: number;
  remaining_tickets: number;
}

class SupabaseSpinWheelRepository {
  async fetchRewards(): Promise<SpinWheelSeasonRewards> {
    const { data, error } = await supabase.rpc("get_spin_wheel_rewards");
    if (error) throw new Error(error.message);
    return data;
  }
}

export const supabaseSpinWheelRepository = new SupabaseSpinWheelRepository();
