import supabase from "../database/connection";

export interface UserProfile {
  id: string;
  experience_point: number;
  level: number;
  inventory_capacity: number;
  species_storage_capacity: number;
  created_at: string;
  updated_at: string;
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
}

export const supabaseUserProfileRepository = new SupabaseUserProfileRepository();
