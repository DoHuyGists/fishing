import supabase from "../database/connection";
import type { RealtimeChannel } from "@supabase/supabase-js";
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
  language: string | null;
}

class SupabaseUserProfileRepository {
  subscribeToProgress(userId: string, onChange: (profile: UserProfile) => void): RealtimeChannel {
    return supabase
      .channel(`user_profile_progress_${userId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "user_profile",
        filter: `id=eq.${userId}`,
      }, (payload) => onChange(payload.new as UserProfile))
      .subscribe();
  }

  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  }

  async updateLanguage(userId: string, language: "vi" | "en"): Promise<void> {
    const { error } = await supabase
      .from("user_profile")
      .update({ language })
      .eq("id", userId)
      .select("language")
      .single();

    if (error) throw new Error(error.message);
  }

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
