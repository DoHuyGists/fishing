import type { MonitorAreaRow, MonitorPlayerRow, MonitorCurrencyRow, MonitorPresenceRow } from "../types/table/adminMonitor";
import type { MonitorSubscriptionHandlers } from "../types/model/adminMonitor";
import type { RealtimeChannel } from "@supabase/supabase-js";
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

  subscribe(handlers: MonitorSubscriptionHandlers): RealtimeChannel {
    return supabase
      .channel("admin-monitor")
      // Listen to every status so that leave/null and area transfers remove old counts.
      .on<MonitorPresenceRow>("postgres_changes", { event: "*", schema: "public", table: "user_in_area" }, (payload) => {
        const row = payload.eventType === "DELETE" ? payload.old : payload.new;
        if (!row.id || (payload.eventType !== "DELETE" && !("status" in row && "area_id" in row))) {
          handlers.onRefresh();
          return;
        }
        handlers.onPlayerChange({
          id: row.id,
          areaId: payload.eventType !== "DELETE" && row.status === "enter" ? row.area_id ?? null : null,
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "fishing_areas" }, handlers.onRefresh)
      // Refetch text balances instead of using potentially rounded Realtime numbers.
      .on("postgres_changes", { event: "*", schema: "public", table: "currency" }, handlers.onCurrencyRefresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          handlers.onStatus("connected");
          // Fetch again after connecting or reconnecting to cover missed changes.
          handlers.onRefresh();
          handlers.onCurrencyRefresh();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          handlers.onStatus("error");
        } else if (status === "CLOSED") {
          handlers.onStatus("disconnected");
        }
      });
  }

  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  }
}

export const supabaseAdminMonitorRepository = new SupabaseAdminMonitorRepository();
