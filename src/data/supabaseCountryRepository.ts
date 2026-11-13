import { readCatalogPages } from './readCatalogPages';
import { RepositoryError } from './repositoryError';
import supabase from "../database/connection";
import type { Country } from "../stores/country";

class SupabaseCountryRepository {
  async fetchMyUnlockedCountries(playerId: string): Promise<Country[]> {
    const { data, error } = await supabase
      .from("player_unlocked_countries")
      .select("country:countries!inner(id, name, code, information, created_at, updated_at, location)")
      .eq("player_id", playerId)
      .returns<{ country: Country }[]>();
    if (error) throw new RepositoryError(error);
    return (data ?? []).map((row) => row.country).sort((a, b) => a.name.localeCompare(b.name));
  }

  async fetchCountries(signal?: AbortSignal): Promise<Country[]> {
    const data = await readCatalogPages((from, to) => supabase
      .from("countries")
      .select("id, name, code, information, created_at, updated_at, location")
      .order("name", { ascending: true }).order("id").abortSignal(signal ?? new AbortController().signal).range(from, to));
    return (data ?? []) as Country[];
  }
}

export const supabaseCountryRepository = new SupabaseCountryRepository();
