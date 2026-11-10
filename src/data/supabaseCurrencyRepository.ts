import supabase from "../database/connection";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface CurrencyRow {
  id: string;
  created_at: string;
  user_id: string;
  cash: number;
  shells: number;
  tickets: number;
}

class SupabaseCurrencyRepository {
  async fetchMyCurrency(): Promise<any> {
    const { data, error } = await supabase.rpc("get_my_currency");

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async fetchTickets(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from("currency")
      .select("tickets")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data?.tickets ?? 0;
  }

  async buyFishingPass(): Promise<void> {
    const { error } = await supabase.rpc("purchase_fishing_pass");
    if (error) throw new Error(error.message);
  }

  async claimDailyReward(): Promise<{ success: boolean; message?: string; item?: any; next_claim_daily_reward_at?: string }> {
    const { data, error } = await supabase.rpc("claim_daily_reward");
    if (error) throw new Error(error.message);
    return data;
  }

  async getNextDailyRewardAt(): Promise<string | null> {
    const { data, error } = await supabase
      .from("user_flag")
      .select("next_claim_daily_reward_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.next_claim_daily_reward_at ?? null;
  }

  /**
   * Đăng ký lắng nghe thay đổi realtime trên bảng currency theo userId.
   */
  subscribeToCurrency(userId: string, onChange: () => void): RealtimeChannel {
    return supabase
      .channel(`currency_realtime_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "currency",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          onChange();
        },
      )
      .subscribe();
  }

  /**
   * Hủy đăng ký realtime channel
   */
  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  }
}

export const supabaseCurrencyRepository = new SupabaseCurrencyRepository();
