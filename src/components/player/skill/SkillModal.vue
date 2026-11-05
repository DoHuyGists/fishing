<script setup lang="ts">
import { watch } from "vue";
import Modal from "../../shared/Modal.vue";
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
    <section class="skill-board mx-auto max-w-6xl space-y-5 rounded-2xl p-3 text-[#24352a] sm:p-6" :aria-busy="skillStore.loading">
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

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article v-for="skill in skillStore.skillCards" :key="skill.id" class="skill-card relative flex min-w-0 flex-col rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 sm:p-5" :class="{ 'skill-card-mastered': skill.isMaxLevel }">
          <div class="mb-4 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-widest">
            <span :class="skill.isMaxLevel ? 'text-[#8b651b]' : skill.level > 0 ? 'text-emerald-700' : 'text-[#75826e]'">{{ skill.isMaxLevel ? '✦ Đã tinh thông' : skill.level > 0 ? '● Đang rèn luyện' : '◇ Chưa học' }}</span>
            <span class="rounded-md border border-[#cbd9c6] bg-white/80 px-2 py-1 tabular-nums">Cấp {{ skill.level }}<span class="text-[#83917c]"> / {{ skill.max_level }}</span></span>
          </div>
          <div class="flex items-center gap-3">
            <div class="skill-emblem flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-3xl" aria-hidden="true">
              <img v-if="skill.isImageIcon" :src="skill.icon!" alt="" class="size-10 object-contain" />
              <span v-else>{{ skill.displayIcon }}</span>
            </div>
            <div class="min-w-0">
              <h4 class="m-0 break-words text-base font-extrabold leading-snug">{{ skill.name }}</h4>
            </div>
          </div>
          <p class="mb-4 mt-3 min-h-10 whitespace-pre-line text-xs leading-relaxed text-[#64715e]">{{ skill.description }}</p>
          <div role="progressbar" :aria-label="`Cấp kỹ năng ${skill.name}`" :aria-valuenow="skill.level" :aria-valuemin="0" :aria-valuemax="skill.max_level" class="mb-4 flex h-2 gap-1">
            <span v-for="step in skill.max_level" :key="step" class="min-w-0 flex-1 rounded-sm border" :class="step <= skill.level ? 'border-emerald-700/20 bg-gradient-to-t from-emerald-700 to-emerald-500' : 'border-[#cbd9c6]/60 bg-[#e3e9dc]'" aria-hidden="true"></span>
          </div>
          <div class="mb-4 space-y-2">
            <template v-for="group in [{ title: 'Mỗi cấp nhận thêm', effects: skill.effects }, { title: 'Hiệu ứng hiện tại', effects: skill.currentEffects }]" :key="group.title">
              <div v-if="group.effects.length" class="rounded-xl border border-[#dce4d3] bg-white/65 p-3 text-xs">
                <p class="mb-2 mt-0 text-[10px] font-bold uppercase tracking-wider text-[#78856b]">{{ group.title }}</p>
                <dl class="m-0 space-y-2">
                  <div v-for="effect in group.effects" :key="effect.label" class="flex items-baseline justify-between gap-3">
                    <dt class="break-words text-[#52634c]">{{ effect.label }}</dt>
                    <dd class="m-0 shrink-0 rounded bg-[#e9f0df] px-2 py-0.5 font-extrabold tabular-nums text-emerald-800">{{ effect.value }}</dd>
                  </div>
                </dl>
              </div>
            </template>
          </div>
          <button type="button" class="skill-upgrade mt-auto flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-extrabold tracking-wide text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" :disabled="skill.isMaxLevel || skillStore.loading || !!skillStore.upgradingId || !!skillStore.error" @click="upgrade(skill.id)">
            <span aria-hidden="true" class="text-base">{{ skill.isMaxLevel ? '✦' : '↑' }}</span>
            {{ skillStore.upgradingId === skill.id ? 'Đang nâng cấp...' : skill.isMaxLevel ? 'Đã đạt cấp tối đa' : `Nâng cấp • Cấp ${skill.level + 1}` }}
          </button>
        </article>
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
.skill-card {
  box-shadow: 0 1px 2px #24352a08;
}
.skill-card-mastered {
  border-color: #c9ad61;
  background: linear-gradient(145deg, #fff9e6, #f5f9f0 65%);
}
.skill-emblem {
  background: linear-gradient(145deg, #fffef4, #e4edcf);
  border: 2px solid #c7d5b2;
  box-shadow: inset 0 0 0 2px #ffffff80;
}
.skill-upgrade {
  background: linear-gradient(#397550, #28613e);
  border: 1px solid #245234;
  box-shadow: 0 1px 1px #1d432b20;
  transition: transform 150ms, filter 150ms, box-shadow 150ms;
}
.skill-upgrade:hover:enabled { filter: brightness(1.1); }
.skill-upgrade:active:enabled {
  transform: translateY(1px);
  box-shadow: none;
}
@media (prefers-reduced-motion: reduce) {
  .skill-upgrade { transition: none; }
}
</style>
