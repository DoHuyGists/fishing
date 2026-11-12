<script setup lang="ts">
import { t as tr } from "../../../i18n";

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
  <article class="skill-card relative flex min-w-0 flex-col rounded-xl border shadow-[0_1px_2px_#24352a08] p-3 sm:p-4" :class="skill.isMaxLevel ? 'skill-card-mastered border-[#c9ad61] bg-[linear-gradient(145deg,#fff9e6,#f5f9f0_65%)]' : 'border-[#cbd9c6] bg-[#f5f9f0]'">
    <div class="mb-3 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-widest">
      <span :class="skill.isMaxLevel ? 'text-[#8b651b]' : skill.level > 0 ? 'text-emerald-700' : 'text-[#75826e]'">{{ skill.isMaxLevel ? tr('SkillCard.da_tinh_thong') : skill.level > 0 ? tr('SkillCard.dang_ren_luyen') : tr('SkillCard.chua_hoc') }}</span>
      <span class="rounded-md border border-[#cbd9c6] bg-white/80 px-2 py-0.5 tabular-nums">{{ tr('FishPond.cap') }} {{ skill.level }}<span class="text-[#83917c]"> / {{ skill.max_level }}</span></span>
    </div>
    <div class="flex items-center gap-2.5">
      <div class="skill-emblem border-2 border-[#c7d5b2] bg-[linear-gradient(145deg,#fffef4,#e4edcf)] shadow-[inset_0_0_0_2px_#ffffff80] flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-2xl" aria-hidden="true">
        <img v-if="skill.isImageIcon" :src="skill.icon!" alt="" class="size-8 object-contain" />
        <span v-else>{{ skill.displayIcon }}</span>
      </div>
      <div class="min-w-0">
        <div class="m-0 break-words text-sm font-extrabold leading-snug">{{ skill.name }}</div>
      </div>
    </div>
    <div class="mb-3 mt-2 min-h-8 whitespace-pre-line text-xs leading-relaxed text-[#64715e]">{{ skill.description }}</div>
    <div role="progressbar" :aria-label="tr('SkillCard.cap_ky_nang_value0', { value0: skill.name })" :aria-valuenow="skill.level" :aria-valuemin="0" :aria-valuemax="skill.max_level" class="mb-3 flex h-1.5 gap-1">
      <span v-for="step in skill.max_level" :key="step" class="min-w-0 flex-1 rounded-sm border" :class="step <= skill.level ? 'border-emerald-700/20 bg-gradient-to-t from-emerald-700 to-emerald-500' : 'border-[#cbd9c6]/60 bg-[#e3e9dc]'" aria-hidden="true"></span>
    </div>
    <div class="mb-3 space-y-1.5">
      <template v-for="group in [{ get title() { return tr('SkillCard.moi_cap_nhan_them'); }, effects: skill.effects }, { get title() { return tr('SkillCard.hieu_ung_hien_tai'); }, effects: skill.currentEffects }]" :key="group.title">
        <div v-if="group.effects.length" class="rounded-lg border border-[#dce4d3] bg-white/65 p-2.5 text-xs">
          <div class="mb-1.5 mt-0 text-[10px] font-bold uppercase tracking-wider text-[#78856b]">{{ group.title }}</div>
          <dl class="m-0 space-y-1.5">
            <div v-for="effect in group.effects" :key="effect.label" class="flex items-baseline justify-between gap-2">
              <dt class="break-words text-[#52634c]">{{ effect.label }}</dt>
              <dd class="m-0 shrink-0 rounded bg-[#e9f0df] px-1.5 py-0.5 font-extrabold tabular-nums text-emerald-800">{{ effect.value }}</dd>
            </div>
          </dl>
        </div>
      </template>
    </div>
    <button type="button" class="skill-upgrade border border-[#245234] bg-[linear-gradient(#397550,#28613e)] shadow-[0_1px_1px_#1d432b20] [transition:transform_150ms,filter_150ms,box-shadow_150ms] enabled:hover:brightness-110 enabled:active:[transform:translateY(1px)] enabled:active:shadow-none motion-reduce:transition-none mt-auto flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-extrabold tracking-wide text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" :disabled="skill.isMaxLevel || disabled || upgrading" @click="emit('upgrade', skill.id)">
      <span aria-hidden="true" class="text-base">{{ skill.isMaxLevel ? '✦' : '↑' }}</span>
      {{ upgrading ? tr('SkillCard.dang_nang_cap') : skill.isMaxLevel ? tr('SkillCard.da_dat_cap_toi_da') : tr('SkillCard.nang_cap_cap_value0', { value0: skill.level + 1 }) }}
    </button>
  </article>
</template>
