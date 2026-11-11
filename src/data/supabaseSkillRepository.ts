import { t as tr } from "../i18n";
import supabase from "../database/connection";

export interface Skill {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  max_level: number;
  effect_per_level: Record<string, unknown>;
  sort_order: number;
  is_disabled: boolean;
}

export interface UserSkill {
  skill_id: string;
  level: number;
}

export interface UpgradeSkillResult {
  success: true;
  skill_id: string;
  skill_code: string;
  skill_name: string;
  previous_level: number;
  current_level: number;
  max_level: number;
  remaining_skill_points: number;
  effects: Record<string, unknown>;
}

export type SkillPayload = Omit<Skill, "id">;

class SupabaseSkillRepository {
  async fetchAll(): Promise<Skill[]> {
    const { data, error } = await supabase.from("skills").select("*").order("sort_order").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Skill[];
  }

  async create(payload: SkillPayload): Promise<Skill> {
    const { data, error } = await supabase.from("skills").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return data as Skill;
  }

  async update(id: string, payload: SkillPayload): Promise<Skill> {
    const { data, error } = await supabase.from("skills")
      .update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return data as Skill;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("skills").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async fetchSkills(): Promise<Skill[]> {
    const { data, error } = await supabase.from("skills").select("*")
      .eq("is_disabled", false).order("sort_order").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Skill[];
  }

  async fetchUserSkills(userId: string): Promise<UserSkill[]> {
    const { data, error } = await supabase.from("user_skills")
      .select("skill_id, level").eq("user_id", userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async upgradeSkill(skillId: string): Promise<UpgradeSkillResult> {
    const { data, error } = await supabase.rpc("upgrade_skill", { p_skill_id: skillId });
    if (error) throw new Error(error.message);
    if (data?.success !== true) {
      throw new Error(data?.message || tr('supabaseSkillRepository.khong_the_nang_cap_ky_nang'));
    }
    return data as UpgradeSkillResult;
  }
}

export const supabaseSkillRepository = new SupabaseSkillRepository();
