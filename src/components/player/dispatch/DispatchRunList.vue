<script setup lang="ts">
import { t as tr } from '../../../i18n';
import { dispatchProgress, dispatchText } from '../../../data/dispatch';
import { formatDateTime } from '../../../utils/time';
import { useDispatchStore } from '../../../stores/dispatch';
import DispatchRewards from './DispatchRewards.vue';
const store = useDispatchStore();
</script>

<template>
  <div v-if="!store.runs.length" class="py-8 text-center text-sm">{{ tr('Dispatch.emptyRuns') }}</div>
  <div class="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
    <article v-for="run in store.runs" :key="run.id" class="dispatch-card slide-fade-in player-content-in">
      <div class="font-bold">{{ dispatchText(run.npc_snapshot.name) }} · {{ dispatchText(run.job_snapshot.name) }}</div>
      <div class="space-y-1 text-xs text-[#61745d]">
        <div>{{ tr('Dispatch.startedAt') }}: {{ formatDateTime(run.started_at) }}</div>
        <div>{{ tr('Dispatch.endsAt') }}: {{ formatDateTime(run.ends_at) }}</div>
      </div>
      <div role="progressbar" :aria-label="tr('Dispatch.progress')" :aria-valuenow="Math.floor(dispatchProgress(run, store.now))" :aria-valuemin="0" :aria-valuemax="100" class="h-3 overflow-hidden rounded-full bg-[#e7ecda]">
        <div class="h-full rounded-full bg-[#527547] transition-[width] duration-700 motion-reduce:transition-none" :style="{ width: dispatchProgress(run, store.now) + '%' }"></div>
      </div>
      <div class="text-xs font-semibold" aria-live="off">{{ store.now >= Date.parse(run.ends_at) ? tr('Dispatch.ready') : tr('Dispatch.remaining', { minutes: Math.ceil((Date.parse(run.ends_at) - store.now) / 60000) }) }}</div>
      <DispatchRewards :rewards="run.rewards" />
      <div class="flex flex-wrap gap-2">
        <template v-if="store.now >= Date.parse(run.ends_at)">
          <button type="button" class="dispatch-button" :disabled="store.locked" @click="store.ask('claim', run.id)">{{ tr('Dispatch.finish') }}</button>
          <button type="button" class="dispatch-button" :disabled="store.locked" @click="store.ask('repeat', run.id)">{{ tr('Dispatch.repeat') }}</button>
        </template>
        <button v-else type="button" class="min-h-8 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50" :disabled="store.locked" @click="store.ask('cancel', run.id)">{{ tr('Dispatch.cancel') }}</button>
      </div>
    </article>
  </div>
</template>
