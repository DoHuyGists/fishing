import supabase from "../database/connection";
import { supabaseAvatarRepository } from "./supabaseAvatarRepository";

export interface UserProfile {
  id: string;
  experience_point: number;
  skill_points: number;
  level: number;
  inventory_capacity: number;
  species_storage_capacity: number;
  pond_slot: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  country_id: string;
  update_country_cooldown: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  onboarding_completed: boolean;
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

    return data ? (await supabaseAvatarRepository.resolveProfiles([data as UserProfile]))[0]! : null;
  }

  async updateCountry(_userId: string, countryId: string): Promise<UserProfile> {
    const { data, error } = await supabase.rpc("update_my_country", { p_country_id: countryId });

    if (error) throw new Error(error.message);
    return (await supabaseAvatarRepository.resolveProfiles([data as UserProfile]))[0]!;
  }

  async updateIdentity(displayName: string, avatarUrl: string | null, avatarPath: string | null): Promise<UserProfile> {
    const { data, error } = await supabase.rpc("update_my_identity", { p_display_name: displayName, p_avatar_url: avatarUrl, p_avatar_path: avatarPath });
    if (error) throw new Error(error.message);
    return (await supabaseAvatarRepository.resolveProfiles([data as UserProfile]))[0]!;
  }

  async completeOnboarding(): Promise<void> {
    const { error } = await supabase.rpc("complete_my_onboarding");
    if (error) throw new Error(error.message);
  }
}

export const supabaseUserProfileRepository = new SupabaseUserProfileRepository();
