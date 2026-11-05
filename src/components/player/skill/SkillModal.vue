<script setup lang="ts">
import { watch } from "vue";
import Modal from "../../shared/Modal.vue";
import { useSkillStore } from "../../../stores/skill";
import { useAuthStore } from "../../../stores/auth";
import { useToast } from "../../../composables/useToast";

const skillStore = useSkillStore();
const authStore = useAuthStore();
const toast = useToast();

function refresh() {
  if (!skillStore.upgradingId) void skillStore.fetchSkills();
}

watch(() => authStore.user?.id, refresh, { immediate: true });

async function upgrade(skillId: string) {
  if (await skillStore.upgradeSkill(skillId)) {
    toast.success("Nâng cấp kỹ năng thành công!", { position: "bottom" });
  }
}
</script>

<template>
  <Modal title="Kỹ năng" sub-title="Rèn luyện kỹ năng cần thủ" :on-refresh="refresh">
    <section class="mx-auto max-w-5xl space-y-4 text-[#24352a]" :aria-busy="skillStore.loading">
      <div class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4">
        <h3 class="m-0 text-lg font-bold">Kỹ năng của bạn</h3>
        <p class="mb-0 mt-1 text-sm">Nâng cấp kỹ năng để cải thiện khả năng câu cá. Mỗi kỹ năng có giới hạn cấp riêng.</p>
      </div>

      <div v-if="skillStore.error" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p class="m-0">{{ skillStore.error }}</p>
        <button type="button" class="mt-2 cursor-pointer font-bold underline disabled:opacity-50" :disabled="skillStore.loading || !!skillStore.upgradingId" @click="refresh">Thử lại</button>
      </div>
      <p v-if="skillStore.upgradeError" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{{ skillStore.upgradeError }}</p>
      <p v-if="skillStore.loading" role="status" class="py-4 text-center text-sm">Đang tải kỹ năng...</p>
      <p v-else-if="!skillStore.error && !skillStore.skillCards.length" class="rounded-xl border border-dashed border-[#cbd9c6] p-8 text-center text-sm">Chưa có kỹ năng nào.</p>

      <div class="grid gap-3 sm:grid-cols-2">
        <article v-for="skill in skillStore.skillCards" :key="skill.id" class="flex flex-col gap-3 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4">
          <div class="flex items-center gap-3">
            <div class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-3xl" aria-hidden="true">
              <img v-if="skill.isImageIcon" :src="skill.icon!" alt="" class="size-full object-contain" />
              <span v-else>{{ skill.icon || '🎣' }}</span>
            </div>
            <div class="min-w-0">
              <h4 class="m-0 break-words font-bold">{{ skill.name }}</h4>
              <p class="mb-0 mt-1 text-xs">{{ skill.level === 0 ? 'Chưa học' : `Cấp ${skill.level}` }} / {{ skill.max_level }}</p>
            </div>
          </div>
          <p v-if="skill.description" class="m-0 whitespace-pre-line text-sm">{{ skill.description }}</p>
          <div role="progressbar" :aria-label="`Cấp kỹ năng ${skill.name}`" :aria-valuenow="skill.level" :aria-valuemin="0" :aria-valuemax="skill.max_level" class="h-2 overflow-hidden rounded-full bg-emerald-950/10">
            <div class="h-full rounded-full bg-emerald-700 transition-[width]" :style="{ width: `${skill.progress}%` }"></div>
          </div>
          <div v-if="skill.effects.length" class="rounded-lg bg-white/70 p-3 text-xs">
            <p class="mb-2 mt-0 font-bold">Hiệu ứng mỗi cấp</p>
            <dl class="m-0 space-y-1">
              <div v-for="effect in skill.effects" :key="effect.label" class="flex flex-wrap justify-between gap-x-3">
                <dt class="break-words">{{ effect.label }}</dt>
                <dd class="m-0 break-all font-semibold">{{ effect.value }}</dd>
              </div>
            </dl>
          </div>
          <button type="button" class="mt-auto cursor-pointer rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" :disabled="skill.isMaxLevel || skillStore.loading || !!skillStore.upgradingId || !!skillStore.error" @click="upgrade(skill.id)">
            {{ skillStore.upgradingId === skill.id ? 'Đang nâng cấp...' : skill.isMaxLevel ? 'Đã đạt cấp tối đa' : `Nâng cấp lên cấp ${skill.level + 1}` }}
          </button>
        </article>
      </div>
    </section>
  </Modal>
</template>
