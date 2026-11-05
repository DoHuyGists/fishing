import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { supabaseSkillRepository, type Skill, type UserSkill } from "../data/supabaseSkillRepository";
import { useAuthStore } from "./auth";
import { useCurrencyStore } from "./currency";

export const useSkillStore = defineStore("skill", () => {
  const authStore = useAuthStore();
  const currencyStore = useCurrencyStore();
  const skills = ref<Skill[]>([]);
  const userSkills = ref<UserSkill[]>([]);
  const loading = ref(false);
  const upgradingId = ref("");
  const error = ref("");
  const upgradeError = ref("");
  let requestId = 0;

  watch(() => authStore.user?.id, () => {
    requestId++;
    skills.value = [];
    userSkills.value = [];
    loading.value = false;
    upgradingId.value = "";
    error.value = "";
    upgradeError.value = "";
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
        effects: Object.entries(skill.effect_per_level ?? {}).map(([key, value]) => ({
          label: key.replace(/_/g, " "),
          value: typeof value === "object" ? JSON.stringify(value) : String(value),
        })),
      };
    });
  });

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
      await supabaseSkillRepository.upgradeSkill(skillId);
      if (authStore.user?.id !== userId) return false;
      // Reload authoritative levels; the RPC response shape is not required here.
      await Promise.all([fetchSkills(), currencyStore.fetchCurrency()]);
      return true;
    } catch (err) {
      if (authStore.user?.id === userId) {
        upgradeError.value = err instanceof Error ? err.message : "Không thể nâng cấp kỹ năng.";
      }
      return false;
    } finally {
      if (authStore.user?.id === userId) upgradingId.value = "";
    }
  }

  return { skillCards, loading, upgradingId, error, upgradeError, fetchSkills, upgradeSkill };
});
