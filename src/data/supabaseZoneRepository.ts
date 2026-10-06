import supabase from "../database/connection";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type WeatherRow = {
  id: string;
  code: string;
  name: string;
  rarity_tier: string;
  duration_min: number;
  duration_max: number;
  image: string | null;
};

export type ZoneWeatherRow = {
  id: string;
  code: string;
  name: string;
  weather_id: string | null;
  weather_expires_at: string | null;
  weather_active_modifiers: any[] | null;
  weather_updated_at: string | null;
  weather: WeatherRow | null;
};

const ZONE_SELECT =
  "id, code, name, weather_id, weather_expires_at, weather_active_modifiers, weather_updated_at, weather:weather_id(id, code, name, rarity_tier, duration_min, duration_max, image)";

class SupabaseZoneRepository {
  async fetchZoneById(zoneId: string): Promise<ZoneWeatherRow | null> {
    const { data, error } = await supabase.from("zones").select(ZONE_SELECT).eq("id", zoneId).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as unknown as ZoneWeatherRow) ?? null;
  }

  // Một query duy nhất: fishing_areas.zone_id -> zones -> weather
  async fetchZoneByAreaId(areaId: string): Promise<ZoneWeatherRow | null> {
    const { data, error } = await supabase.from("fishing_areas").select(`zone:zone_id(${ZONE_SELECT})`).eq("id", areaId).maybeSingle();
    if (error) throw new Error(error.message);
    return ((data as any)?.zone as ZoneWeatherRow) ?? null;
  }
  subscribeToZone(zoneId: string, onChange: () => void): RealtimeChannel {
    return supabase
      .channel(`zones_realtime_${zoneId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "zones", filter: `id=eq.${zoneId}` }, () => onChange())
      .subscribe();
  }

  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  }
}

export const supabaseZoneRepository = new SupabaseZoneRepository();

