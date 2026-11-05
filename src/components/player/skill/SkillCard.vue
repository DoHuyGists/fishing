<script setup lang="ts">
import type { SkillCard } from "../../../stores/skill";

defineProps<{
  skill: SkillCard;
  disabled: boolean;
  upgrading: boolean;
}>();

const emit = defineEmits<{
  upgrade: [skillId: string];
}>();
</script>

<template>
  <article class="skill-card relative flex min-w-0 flex-col rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3 sm:p-4" :class="{ 'skill-card-mastered': skill.isMaxLevel }">
    <div class="mb-3 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-widest">
      <span :class="skill.isMaxLevel ? 'text-[#8b651b]' : skill.level > 0 ? 'text-emerald-700' : 'text-[#75826e]'">{{ skill.isMaxLevel ? '✦ Đã tinh thông' : skill.level > 0 ? '● Đang rèn luyện' : '◇ Chưa học' }}</span>
      <span class="rounded-md border border-[#cbd9c6] bg-white/80 px-2 py-0.5 tabular-nums">Cấp {{ skill.level }}<span class="text-[#83917c]"> / {{ skill.max_level }}</span></span>
    </div>
    <div class="flex items-center gap-2.5">
      <div class="skill-emblem flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-2xl" aria-hidden="true">
        <img v-if="skill.isImageIcon" :src="skill.icon!" alt="" class="size-8 object-contain" />
        <span v-else>{{ skill.displayIcon }}</span>
      </div>
      <div class="min-w-0">
        <h4 class="m-0 break-words text-sm font-extrabold leading-snug">{{ skill.name }}</h4>
      </div>
    </div>
    <p class="mb-3 mt-2 min-h-8 whitespace-pre-line text-xs leading-relaxed text-[#64715e]">{{ skill.description }}</p>
    <div role="progressbar" :aria-label="`Cấp kỹ năng ${skill.name}`" :aria-valuenow="skill.level" :aria-valuemin="0" :aria-valuemax="skill.max_level" class="mb-3 flex h-1.5 gap-1">
      <span v-for="step in skill.max_level" :key="step" class="min-w-0 flex-1 rounded-sm border" :class="step <= skill.level ? 'border-emerald-700/20 bg-gradient-to-t from-emerald-700 to-emerald-500' : 'border-[#cbd9c6]/60 bg-[#e3e9dc]'" aria-hidden="true"></span>
    </div>
    <div class="mb-3 space-y-1.5">
      <template v-for="group in [{ title: 'Mỗi cấp nhận thêm', effects: skill.effects }, { title: 'Hiệu ứng hiện tại', effects: skill.currentEffects }]" :key="group.title">
        <div v-if="group.effects.length" class="rounded-lg border border-[#dce4d3] bg-white/65 p-2.5 text-xs">
          <p class="mb-1.5 mt-0 text-[10px] font-bold uppercase tracking-wider text-[#78856b]">{{ group.title }}</p>
          <dl class="m-0 space-y-1.5">
            <div v-for="effect in group.effects" :key="effect.label" class="flex items-baseline justify-between gap-2">
              <dt class="break-words text-[#52634c]">{{ effect.label }}</dt>
              <dd class="m-0 shrink-0 rounded bg-[#e9f0df] px-1.5 py-0.5 font-extrabold tabular-nums text-emerald-800">{{ effect.value }}</dd>
            </div>
          </dl>
        </div>
      </template>
    </div>
    <button type="button" class="skill-upgrade mt-auto flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-extrabold tracking-wide text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" :disabled="skill.isMaxLevel || disabled || upgrading" @click="emit('upgrade', skill.id)">
      <span aria-hidden="true" class="text-base">{{ skill.isMaxLevel ? '✦' : '↑' }}</span>
      {{ upgrading ? 'Đang nâng cấp...' : skill.isMaxLevel ? 'Đã đạt cấp tối đa' : `Nâng cấp • Cấp ${skill.level + 1}` }}
    </button>
  </article>
</template>

<style scoped>
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
