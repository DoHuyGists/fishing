import type { Skill } from "../model/skill";

export type SkillPayload = Omit<Skill, "id">;
