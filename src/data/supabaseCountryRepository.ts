import supabase from "../database/connection";
import type { Country } from "../stores/country";

class SupabaseCountryRepository {
  async fetchCountries(): Promise<Country[]> {
    const { data, error } = await supabase
      .from("countries")
      .select("id, name, code, information, created_at, updated_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Country[];
  }
}

export const supabaseCountryRepository = new SupabaseCountryRepository();
