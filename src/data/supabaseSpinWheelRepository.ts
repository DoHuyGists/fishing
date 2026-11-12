import type { SpinWheelSeasonRewards } from "../types/model/spinWheel";
import supabase from "../database/connection";

class SupabaseSpinWheelRepository {
  async fetchRewards(): Promise<SpinWheelSeasonRewards> {
    const { data, error } = await supabase.rpc("get_spin_wheel_rewards");
    if (error) throw new Error(error.message);
    return data;
  }
}

export const supabaseSpinWheelRepository = new SupabaseSpinWheelRepository();
