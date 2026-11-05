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

class SupabaseSkillRepository {
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

  async upgradeSkill(skillId: string): Promise<void> {
    const { data, error } = await supabase.rpc("upgrade_skill", { p_skill_id: skillId });
    if (error) throw new Error(error.message);
    if (data === false || data?.success === false) {
      throw new Error(data?.message || "Không thể nâng cấp kỹ năng.");
    }
  }
}

export const supabaseSkillRepository = new SupabaseSkillRepository();
