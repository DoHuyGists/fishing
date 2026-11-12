import supabase from "../database/connection";
import type { Country } from "../stores/country";
import { createUuid } from "../utils/uuid";

class SupabaseCountryRepository {
  async fetchMapColors(): Promise<{ country_id: number; color: string | null }[]> {
    const { data, error } = await supabase.from("country_values").select("country_id,color");
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async fetchMyUnlockedCountries(playerId: string): Promise<Country[]> {
    const { data, error } = await supabase
      .from("player_unlocked_countries")
      .select("country:countries!inner(id, name, code, information, created_at, updated_at, location)")
      .eq("player_id", playerId)
      .returns<{ country: Country }[]>();
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.country).sort((a, b) => a.name.localeCompare(b.name));
  }

  subscribeToUnlockedCountries(playerId: string, onChange: () => void): () => void {
    const channel = supabase
      .channel(`unlocked_countries_${playerId}_${createUuid()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "player_unlocked_countries",
        filter: `player_id=eq.${playerId}`,
      }, onChange)
      .subscribe((status) => {
        // Refresh after subscribing/reconnecting to recover changes missed while offline.
        if (status === "SUBSCRIBED") onChange();
      });

    return () => { void supabase.removeChannel(channel); };
  }

  async fetchCountries(): Promise<Country[]> {
    const { data, error } = await supabase
      .from("countries")
      .select("id, name, code, information, created_at, updated_at, location")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Country[];
  }
}

export const supabaseCountryRepository = new SupabaseCountryRepository();
