import type { UserSetting } from "../types/model/userSetting";
import supabase from "../database/connection";

class SupabaseUserSettingRepository {
  async fetch(userId: string): Promise<UserSetting | null> {
    const { data, error } = await supabase
      .from("user_setting")
      .select("id, is_fishing_background_sound_turn_on")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async saveFishingBackgroundSound(userId: string, enabled: boolean): Promise<void> {
    const { error } = await supabase.from("user_setting").upsert({
      id: userId,
      is_fishing_background_sound_turn_on: enabled,
    }, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
}

export const supabaseUserSettingRepository = new SupabaseUserSettingRepository();
