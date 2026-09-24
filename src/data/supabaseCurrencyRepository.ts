import supabase from "../database/connection";

export interface CurrencyRow {
  id: number;
  created_at: string;
  user_id: string;
  cash: number;
}

class SupabaseCurrencyRepository {
  async fetchCurrencyByUserId(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from("currency")
      .select("cash")
      .eq("user_id", userId)
      .maybeSingle<{ cash: number }>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return this.createDefaultCurrency(userId);
    }

    return data.cash ?? 0;
  }

  private async createDefaultCurrency(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from("currency")
      .insert({ user_id: userId, cash: 0 })
      .select("cash")
      .single<{ cash: number }>();

    if (error) {
      const { data: retryData } = await supabase
        .from("currency")
        .select("cash")
        .eq("user_id", userId)
        .maybeSingle<{ cash: number }>();
      return retryData?.cash ?? 0;
    }

    return data?.cash ?? 0;
  }

  async updateCurrency(userId: string, newCash: number): Promise<void> {
    const { error } = await supabase
      .from("currency")
      .update({ cash: newCash })
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async addCash(userId: string, amount: number): Promise<number> {
    const current = await this.fetchCurrencyByUserId(userId);
    const updated = Math.max(0, current + amount);
    await this.updateCurrency(userId, updated);
    return updated;
  }
}

export const supabaseCurrencyRepository = new SupabaseCurrencyRepository();
