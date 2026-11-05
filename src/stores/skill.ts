import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { supabaseSkillRepository, type Skill, type UserSkill } from "../data/supabaseSkillRepository";
import { useAuthStore } from "./auth";
import { useUserProfileStore } from "./userProfile";

const effectLabels: Record<string, string> = {
  catch_rate_bonus: "Tỷ lệ câu thành công",
  xp_bonus: "Kinh nghiệm nhận được",
  bite_time_reduction: "Giảm thời gian cá cắn câu",
  shiny_rate_bonus: "Cơ hội gặp cá Shiny",
  luck_bonus: "May mắn",
};

const skillIcons: Record<string, string> = {
  fish: "🐟", star: "⭐", timer: "⏳", clock: "⏳", sparkles: "✨",
  spark: "✨", clover: "🍀", luck: "🍀", anchor: "⚓", hook: "🪝",
  shield: "🛡️", zap: "⚡", target: "🎯", trophy: "🏆",
};

function formatEffects(effects: Record<string, unknown>) {
  return Object.entries(effects).map(([key, value]) => ({
    label: effectLabels[key] ?? key.replace(/_/g, " "),
    value: typeof value === "object" ? JSON.stringify(value) : String(value),
  }));
}

export const useSkillStore = defineStore("skill", () => {
  const authStore = useAuthStore();
  const userProfileStore = useUserProfileStore();
  const skills = ref<Skill[]>([]);
  const userSkills = ref<UserSkill[]>([]);
  const loading = ref(false);
  const upgradingId = ref("");
  const error = ref("");
  const upgradeError = ref("");
  const remainingSkillPoints = ref<number | null>(null);
  const currentEffects = ref<Record<string, Record<string, unknown>>>({});
  let requestId = 0;

  watch(() => authStore.user?.id, () => {
    requestId++;
    skills.value = [];
    userSkills.value = [];
    loading.value = false;
    upgradingId.value = "";
    error.value = "";
    upgradeError.value = "";
    remainingSkillPoints.value = null;
    currentEffects.value = {};
  }, { flush: "sync" });

  const skillCards = computed(() => {
    const levels = new Map(userSkills.value.map((skill) => [skill.skill_id, skill.level]));
    return skills.value.map((skill) => {
      const level = levels.get(skill.id) ?? 0;
      return {
        ...skill,
        level,
        isMaxLevel: level >= skill.max_level,
        progress: Math.min(100, level / skill.max_level * 100),
        isImageIcon: /^(https?:\/\/|\/)/i.test(skill.icon ?? ""),
        displayIcon: skillIcons[skill.icon?.toLowerCase() ?? ""]
          ?? (skill.icon && /\p{Extended_Pictographic}/u.test(skill.icon) ? skill.icon : "🎣"),
        effects: formatEffects(skill.effect_per_level ?? {}),
        currentEffects: formatEffects(currentEffects.value[skill.id] ?? {}),
      };
    });
  });

  const learnedCount = computed(() => skillCards.value.filter((skill) => skill.level > 0).length);
  const totalLevels = computed(() => skillCards.value.reduce((total, skill) => total + skill.level, 0));

  async function fetchSkills() {
    const userId = authStore.user?.id;
    const currentRequest = ++requestId;
    error.value = "";
    if (!userId) {
      error.value = "Vui lòng đăng nhập để xem kỹ năng.";
      return false;
    }
    loading.value = true;
    try {
      const [catalog, owned] = await Promise.all([
        supabaseSkillRepository.fetchSkills(),
        supabaseSkillRepository.fetchUserSkills(userId),
      ]);
      if (currentRequest !== requestId) return false;
      skills.value = catalog;
      userSkills.value = owned;
      return true;
    } catch (err) {
      if (currentRequest === requestId) {
        error.value = err instanceof Error ? err.message : "Không thể tải kỹ năng.";
      }
      return false;
    } finally {
      if (currentRequest === requestId) loading.value = false;
    }
  }

  async function upgradeSkill(skillId: string) {
    const userId = authStore.user?.id;
    const skill = skillCards.value.find((item) => item.id === skillId);
    if (!userId || !skill || skill.isMaxLevel || upgradingId.value || loading.value || error.value) return false;
    upgradingId.value = skillId;
    upgradeError.value = "";
    try {
      const result = await supabaseSkillRepository.upgradeSkill(skillId);
      if (authStore.user?.id !== userId) return false;
      const owned = userSkills.value.find((item) => item.skill_id === result.skill_id);
      if (owned) owned.level = result.current_level;
      else userSkills.value.push({ skill_id: result.skill_id, level: result.current_level });
      const catalogSkill = skills.value.find((item) => item.id === result.skill_id);
      if (catalogSkill) {
        catalogSkill.code = result.skill_code;
        catalogSkill.name = result.skill_name;
        catalogSkill.max_level = result.max_level;
      }
      remainingSkillPoints.value = result.remaining_skill_points;
      if (userProfileStore.profile?.id === userId) {
        userProfileStore.profile.skill_points = result.remaining_skill_points;
      }
      currentEffects.value[result.skill_id] = result.effects;
      return result;
    } catch (err) {
      if (authStore.user?.id === userId) {
        upgradeError.value = err instanceof Error ? err.message : "Không thể nâng cấp kỹ năng.";
      }
      return false;
    } finally {
      if (authStore.user?.id === userId) upgradingId.value = "";
    }
  }

  return { skillCards, learnedCount, totalLevels, remainingSkillPoints, loading, upgradingId, error, upgradeError, fetchSkills, upgradeSkill };
});
