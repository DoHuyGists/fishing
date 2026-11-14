<script setup lang="ts">
import { t as tr } from '../../../i18n';
import { dispatchText } from '../../../data/dispatch';
import { useDispatchStore } from '../../../stores/dispatch';
import Cash from '../currency/Cash.vue';
const store = useDispatchStore();
</script>

<template>
  <form class="space-y-2 rounded-lg border border-[#cbd9c6] bg-white p-2.5" @submit.prevent="store.selectedOwned && store.selectedJob && store.ask('start', store.selectedOwned.id, store.selectedJob.id)">
    <div class="text-xs font-bold">{{ tr('Dispatch.assignment') }}</div>
    <div class="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label class="space-y-1 text-xs">
        <span>{{ tr('Dispatch.chooseNpc') }}</span>
        <select v-model="store.selectedNpcId" class="min-h-8 w-full min-w-0 rounded-md border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1" :disabled="store.locked">
          <option value="">{{ tr('Dispatch.chooseNpc') }}</option>
          <option v-for="owned in store.owned" :key="owned.id" :value="owned.npc_id" :disabled="store.runs.some(r => r.owned_npc_id === owned.id) || !store.npcs.find(n => n.id === owned.npc_id)?.enabled">
            {{ dispatchText(store.npcs.find(n => n.id === owned.npc_id)?.name ?? {}) }}{{ store.runs.some(r => r.owned_npc_id === owned.id) ? ' · ' + tr('Dispatch.working') : '' }}
          </option>
        </select>
      </label>
      <label class="space-y-1 text-xs">
        <span>{{ tr('Dispatch.chooseJob') }}</span>
        <select v-model="store.selectedJobId" class="min-h-8 w-full min-w-0 rounded-md border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1" :disabled="store.locked">
          <option value="">{{ tr('Dispatch.chooseJob') }}</option>
          <option v-for="job in store.jobs" :key="job.id" :value="job.id">{{ dispatchText(job.name) }}</option>
        </select>
      </label>
      <button type="submit" class="dispatch-button" :disabled="store.locked || !store.canAssign">{{ tr('Dispatch.start') }}</button>
    </div>
    <div v-if="store.selectedNpc" class="flex items-center gap-2 text-xs"><span>{{ tr('Dispatch.operatingCost') }}</span><Cash :amount="store.selectedNpc.operating_cash" :size="20" :interactive="false" /></div>
    <div v-if="store.selectedNpc && store.selectedJob && !store.canAssign" class="text-xs text-amber-800">{{ tr('Dispatch.assignmentHint') }}</div>
  </form>
</template>
