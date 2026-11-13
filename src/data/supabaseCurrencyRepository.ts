import { RepositoryError } from './repositoryError';
import type { CurrencyRow } from "../types/table/currency";
import type { CurrencyConversionRate } from "../types/model/currency";
import supabase from "../database/connection";

class SupabaseCurrencyRepository {
  async fetchConversionRates(signal?: AbortSignal): Promise<CurrencyConversionRate[]> {
    const { data, error, status } = await supabase.rpc("get_currency_conversion_rates").abortSignal(signal ?? new AbortController().signal);
    if (error) throw new RepositoryError({ ...error, status });
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
    if (error) throw new RepositoryError(error);
    return data;
  }

  async fetchMyCurrency(): Promise<any> {
    const { data, error } = await supabase.rpc("get_my_currency");

    if (error) {
      throw new RepositoryError(error);
    }

    return data;
  }

  async fetchWallet(userId: string): Promise<Pick<CurrencyRow, 'cash' | 'shells' | 'tickets'>> {
    const { data, error } = await supabase.from('currency').select('cash,shells,tickets').eq('user_id', userId).single();
    if (error) throw new RepositoryError(error);
    return { cash: Number(data.cash), shells: Number(data.shells ?? 0), tickets: Number(data.tickets ?? 0) };
  }

  async fetchTickets(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from("currency")
      .select("tickets")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new RepositoryError(error);
    return data?.tickets ?? 0;
  }

  async buyFishingPass(): Promise<void> {
    const { error } = await supabase.rpc("purchase_fishing_pass");
    if (error) throw new RepositoryError(error);
  }

  async claimDailyReward(): Promise<{ success: boolean; message?: string; item?: any; next_claim_daily_reward_at?: string }> {
    const { data, error } = await supabase.rpc("claim_daily_reward");
    if (error) throw new RepositoryError(error);
    return data;
  }

  async getNextDailyRewardAt(): Promise<string | null> {
    const { data, error } = await supabase
      .from("user_flag")
      .select("next_claim_daily_reward_at")
      .maybeSingle();
    if (error) throw new RepositoryError(error);
    return data?.next_claim_daily_reward_at ?? null;
  }

}

export const supabaseCurrencyRepository = new SupabaseCurrencyRepository();
