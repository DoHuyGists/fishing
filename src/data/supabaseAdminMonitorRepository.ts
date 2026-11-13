import type { MonitorAreaRow, MonitorPlayerRow, MonitorCurrencyRow } from "../types/table/adminMonitor";
import supabase from "../database/connection";

const PAGE_SIZE = 500;

class SupabaseAdminMonitorRepository {
  async fetchAreas(): Promise<MonitorAreaRow[]> {
    const areas: MonitorAreaRow[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("fishing_areas")
        .select("id, title, country_id, is_available")
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      areas.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) return areas;
    }
  }

  async fetchActivePlayers(): Promise<MonitorPlayerRow[]> {
    const players: MonitorPlayerRow[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("user_in_area")
        .select("id, area_id")
        .eq("status", "enter")
        .not("area_id", "is", null)
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      players.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) return players;
    }
  }

  async fetchCurrencies(): Promise<MonitorCurrencyRow[]> {
    const wallets: MonitorCurrencyRow[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("currency")
        // Read bigint as text so JSON parsing cannot round large balances.
        .select("id, user_id, cash::text, shells::text")
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      wallets.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) return wallets;
    }
  }

}

export const supabaseAdminMonitorRepository = new SupabaseAdminMonitorRepository();
