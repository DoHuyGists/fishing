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
