import supabase from "../database/connection";

export interface Species {
  id: string;
  created_at: string;
  information: string | null;
  location: string | null;
  status: string | null;
  name: string;
  image: string | null;
}

export interface CaughtDiary {
  id: number;
  created_at: string;
  user_id: string;
  species_id: string;
}

class SupabaseDiaryRepository {
  /**
   * Fetch all fish species from the `species` table.
   */
  async fetchSpecies(): Promise<Species[]> {
    const { data, error } = await supabase
      .from("species")
      .select("id, created_at, information, location, status, name, image")
      .order("location", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching species:", error);
      throw new Error(error.message);
    }

    return data ?? [];
  }

  /**
   * Fetch species filtered by location (matches country code or country name).
   */
  async fetchSpeciesByLocation(locationCode: string, locationName?: string): Promise<Species[]> {
    let query = supabase
      .from("species")
      .select("id, created_at, information, location, status, name, image");

    if (locationName) {
      query = query.or(`location.eq.${locationCode},location.eq.${locationName},location.ilike.%${locationCode}%,location.ilike.%${locationName}%`);
    } else {
      query = query.or(`location.eq.${locationCode},location.ilike.%${locationCode}%`);
    }

    const { data, error } = await query.order("name", { ascending: true });

    if (error) {
      console.error(`Error fetching species for location ${locationCode}:`, error);
      // Fallback: fetch all species
      return this.fetchSpecies();
    }

    return data ?? [];
  }

  /**
   * Fetch caught diary records for a specific user from `caught_diary`.
   */
  async fetchCaughtDiary(userId: string): Promise<CaughtDiary[]> {
    if (!userId) return [];

    const { data, error } = await supabase
      .from("caught_diary")
      .select("id, created_at, user_id, species_id")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching caught_diary:", error);
      throw new Error(error.message);
    }

    return data ?? [];
  }
}

export const supabaseDiaryRepository = new SupabaseDiaryRepository();
