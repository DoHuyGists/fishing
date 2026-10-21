import supabase from "../database/connection";

export interface UserProfile {
  id: string;
  experience_point: number;
  level: number;
  inventory_capacity: number;
  species_storage_capacity: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  country_id: string;
  update_country_cooldown: string;
}

class SupabaseUserProfileRepository {
  async fetchUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from("user_profile")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data as UserProfile | null;
  }

  async updateCountry(userId: string, countryId: string): Promise<UserProfile> {
    const { data, error } = await supabase
      .from("user_profile")
      .update({ country_id: countryId })
      .eq("id", userId)
      .is("country_id", null)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data as UserProfile;
  }
}

export const supabaseUserProfileRepository = new SupabaseUserProfileRepository();
