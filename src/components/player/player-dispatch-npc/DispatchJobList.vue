<script setup lang="ts">
import { t as tr } from "../../../i18n/index.ts";
import { dispatchEligible, dispatchText } from "../../../data/dispatch.ts";
import { useDispatchStore } from "../../../stores/player-dispatch-store.ts";
import DispatchRewards from "./DispatchRewards.vue";
import DispatchPortrait from "./DispatchPortrait.vue";
import DispatchStats from "./DispatchStats.vue";
const store = useDispatchStore();
</script>

<template>
  <div v-if="!store.jobs.length" class="py-8 text-center text-sm">{{ tr("Dispatch.emptyJobs") }}</div>
  <div class="dispatch-grid">
    <article
      v-for="(job, index) in store.jobs"
      :key="job.id"
      class="dispatch-card slide-fade-in from-bottom player-content-in"
      :class="{ 'ring-2 ring-accent': store.selectedJobId === job.id }"
      :style="{ '--delay': `${index * 45}ms` }"
    >
      <div class="flex items-center gap-3">
        <DispatchPortrait :src="job.image_path" fallback="🧭" />
        <div class="min-w-0 space-y-1.5">
          <div class="font-bold">{{ dispatchText(job.name) }}</div>
          <div class="text-xs text-content">
            {{ tr("Dispatch.duration", { minutes: Math.ceil(job.duration_seconds / 60) }) }}
          </div>
        </div>
      </div>
      <div v-if="dispatchText(job.description)" class="text-xs leading-relaxed">
        {{ dispatchText(job.description) }}
      </div>
      <div class="space-y-2">
        <div class="text-xs font-semibold">{{ tr("Dispatch.requirements") }}</div>
        <DispatchStats :stats="job.data.requirements" requirements />
        <div v-if="!Object.keys(job.data.requirements ?? {}).length" class="text-xs">
          {{ tr("Dispatch.noRequirements") }}
        </div>
      </div>
      <DispatchRewards
        class="border-t border-border-default pt-3"
        :rewards="job.rewards"
        :delivery-items="job.data.delivery_items"
      />
      <div v-if="store.selectedNpc && !dispatchEligible(store.selectedNpc, job)" class="text-xs text-gold">
        {{ tr("Dispatch.errorRequirements") }}
      </div>
      <button
        type="button"
        class="dispatch-button mt-auto w-full"
        :disabled="store.locked"
        @click="store.selectJob(job.id)"
      >
        {{ tr("Dispatch.chooseJob") }}
      </button>
    </article>
  </div>
</template>
