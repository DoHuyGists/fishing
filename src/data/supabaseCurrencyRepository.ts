import supabase from "../database/connection";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface CurrencyRow {
  id: string;
  created_at: string;
  user_id: string;
  cash: number;
}

class SupabaseCurrencyRepository {
  async fetchMyCurrency(): Promise<any> {
    const { data, error } = await supabase.rpc("get_my_currency");

    if (error) {
      throw new Error(error.message);
    }

    return data;
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
