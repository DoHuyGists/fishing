import type { Skill, UserSkill, UpgradeSkillResult } from "../types/model/skill";
import type { SkillPayload } from "../types/table/skill";
import { t as tr } from "../i18n";
import supabase from "../database/connection";

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
