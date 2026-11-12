import type { CurrencyRow } from "../types/table/currency";
import type { CurrencyConversionRate } from "../types/model/currency";
import supabase from "../database/connection";
import type { RealtimeChannel } from "@supabase/supabase-js";

class SupabaseCurrencyRepository {
  async fetchConversionRates(): Promise<CurrencyConversionRate[]> {
    const { data, error } = await supabase.rpc("get_currency_conversion_rates");
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async convertCurrency(rate: CurrencyConversionRate, batches: number): Promise<Pick<CurrencyRow, "cash" | "shells" | "tickets">> {
    const { data, error } = await supabase.rpc("convert_currency", {
      p_source_currency: rate.source_currency,
      p_target_currency: rate.target_currency,
      p_batches: batches,
      p_source_amount: rate.source_amount,
      p_target_amount: rate.target_amount,
    });
    if (error) throw new Error(error.message);
    return data;
  }

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
