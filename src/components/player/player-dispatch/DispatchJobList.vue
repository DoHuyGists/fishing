<script setup lang="ts">
import { t as tr } from '../../../i18n';
import { dispatchEligible, dispatchText } from '../../../data/dispatch';
import { useDispatchStore } from '../../../stores/dispatch';
import DispatchRewards from './DispatchRewards.vue';
const store = useDispatchStore();
</script>

<template>
  <div v-if="!store.jobs.length" class="py-8 text-center text-sm">{{ tr('Dispatch.emptyJobs') }}</div>
  <div class="dispatch-grid">
    <article v-for="job in store.jobs" :key="job.id" class="dispatch-card slide-fade-in player-content-in" :class="{ 'ring-2 ring-[#527547]': store.selectedJobId === job.id }">
      <div class="flex items-center gap-2">
        <img v-if="job.image_path" :src="job.image_path" :alt="dispatchText(job.name)" class="size-10 shrink-0 rounded-md object-contain" loading="lazy">
        <span v-else aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#f5f9f0] text-2xl">🧭</span>
        <div class="min-w-0">
          <div class="font-bold">{{ dispatchText(job.name) }}</div>
          <div class="text-xs text-[#61745d]">{{ tr('Dispatch.duration', { minutes: Math.ceil(job.duration_seconds / 60) }) }}</div>
        </div>
      </div>
      <div>{{ dispatchText(job.description) }}</div>
      <div class="text-xs">{{ tr('Dispatch.requirements') }}</div>
      <div class="flex flex-wrap gap-1 text-[11px]">
        <span v-for="(value, key) in job.data.requirements" :key="key" class="rounded bg-[#f5f9f0] px-1.5 py-0.5">{{ key }} ≥ {{ value }}</span>
        <span v-if="!Object.keys(job.data.requirements ?? {}).length">{{ tr('Dispatch.noRequirements') }}</span>
      </div>
      <DispatchRewards :rewards="job.rewards" />
      <div v-if="store.selectedNpc && !dispatchEligible(store.selectedNpc, job)" class="text-xs text-amber-800">{{ tr('Dispatch.errorRequirements') }}</div>
      <button type="button" class="dispatch-button w-full" :disabled="store.locked" @click="store.selectJob(job.id)">{{ tr('Dispatch.chooseJob') }}</button>
    </article>
  </div>
</template>
