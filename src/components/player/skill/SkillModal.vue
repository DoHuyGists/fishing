<script setup lang="ts">
import { watch } from "vue";
import Modal from "../../shared/Modal.vue";
import SkillCard from "./SkillCard.vue";
import { useSkillStore } from "../../../stores/skill";
import { useAuthStore } from "../../../stores/auth";
import { useToast } from "../../../composables/useToast";

const skillStore = useSkillStore();
const authStore = useAuthStore();
const toast = useToast();

async function refresh() {
  if (skillStore.upgradingId) return;
  if (!await skillStore.fetchSkills() && skillStore.error) {
    toast.error(skillStore.error, { title: "Không thể tải kỹ năng", position: "bottom" });
  }
}

watch(() => authStore.user?.id, refresh, { immediate: true });

async function upgrade(skillId: string) {
  const result = await skillStore.upgradeSkill(skillId);
  if (result) {
    toast.success(`Đã nâng ${result.skill_name} lên cấp ${result.current_level}!`, { title: "Nâng cấp thành công", position: "bottom" });
  } else if (skillStore.upgradeError) {
    toast.error(skillStore.upgradeError, { title: "Nâng cấp thất bại", position: "bottom" });
  }
}
</script>

<template>
  <Modal title="Kỹ năng" sub-title="Rèn luyện kỹ năng cần thủ" :on-refresh="refresh">
    <section class="skill-board min-h-full w-full space-y-4 rounded-2xl p-3 text-[#24352a] sm:p-4" :aria-busy="skillStore.loading">
      <button v-if="skillStore.error" type="button" class="cursor-pointer text-sm font-bold text-emerald-800 underline disabled:opacity-50" :disabled="skillStore.loading || !!skillStore.upgradingId" @click="refresh">Tải lại kỹ năng</button>
      <p v-if="skillStore.loading" role="status" class="py-4 text-center text-sm">Đang tải kỹ năng...</p>
      <p v-else-if="!skillStore.error && !skillStore.skillCards.length" class="rounded-xl border border-dashed border-[#cbd9c6] p-8 text-center text-sm">Chưa có kỹ năng nào.</p>

      <div class="flex flex-wrap items-center gap-3">
        <p class="m-0 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#60745d]">Chọn kỹ năng để rèn luyện</p>
        <span aria-hidden="true" class="h-px flex-1 bg-[#cbd9c6]"></span>
        <p v-if="skillStore.remainingSkillPoints !== null" role="status" class="m-0 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-1.5 text-xs text-[#52634c]">
          <span aria-hidden="true" class="mr-1 text-[#8b651b]">✦</span> Điểm kỹ năng: <strong class="tabular-nums text-emerald-800">{{ skillStore.remainingSkillPoints }}</strong>
        </p>
      </div>

      <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-3">
        <SkillCard
          v-for="skill in skillStore.skillCards"
          :key="skill.id"
          :skill="skill"
          :disabled="skillStore.loading || !!skillStore.upgradingId || !!skillStore.error"
          :upgrading="skillStore.upgradingId === skill.id"
          @upgrade="upgrade"
        />
      </div>
    </section>
  </Modal>
</template>

<style scoped>
.skill-board {
  background-color: #edf2e6;
  background-image: radial-gradient(#b6c6a84d 0.7px, transparent 0.7px);
  background-size: 12px 12px;
}
</style>
