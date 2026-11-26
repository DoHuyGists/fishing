<script setup lang="ts">
import { t as tr } from "../../../i18n/index.ts";
import { dispatchText } from "../../../data/dispatch.ts";
import { useDispatchStore } from "../../../stores/player-dispatch-store.ts";
import Cash from "../player-currency/Cash.vue";
import DispatchRewards from "./DispatchRewards.vue";
const store = useDispatchStore();
</script>

<template>
  <form
    class="space-y-4 rounded-xl border border-border-default bg-white p-4"
    @submit.prevent="
      store.selectedOwned && store.selectedJob && store.ask('start', store.selectedOwned.id, store.selectedJob.id)
    "
  >
    <div class="font-bold">{{ tr("Dispatch.assignment") }}</div>
    <div class="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-1">
      <label class="min-w-0 space-y-2 text-xs">
        <span>{{ tr("Dispatch.chooseNpc") }}</span>
        <select
          v-model="store.selectedNpcId"
          class="min-h-10 w-full min-w-0 rounded-lg border border-border-default bg-surface px-3 py-2 text-sm"
          :disabled="store.locked"
        >
          <option value="">{{ tr("Dispatch.chooseNpc") }}</option>
          <option
            v-for="owned in store.owned"
            :key="owned.id"
            :value="owned.npc_id"
            :disabled="
              store.runs.some((r) => r.owned_npc_id === owned.id) ||
              !store.npcs.find((n) => n.id === owned.npc_id)?.enabled
            "
          >
            {{ dispatchText(store.npcs.find((n) => n.id === owned.npc_id)?.name ?? {})
            }}{{ store.runs.some((r) => r.owned_npc_id === owned.id) ? " · " + tr("Dispatch.working") : "" }}
          </option>
        </select>
      </label>
      <label class="min-w-0 space-y-2 text-xs">
        <span>{{ tr("Dispatch.chooseJob") }}</span>
        <select
          v-model="store.selectedJobId"
          class="min-h-10 w-full min-w-0 rounded-lg border border-border-default bg-surface px-3 py-2 text-sm"
          :disabled="store.locked"
        >
          <option value="">{{ tr("Dispatch.chooseJob") }}</option>
          <option v-for="job in store.jobs" :key="job.id" :value="job.id">{{ dispatchText(job.name) }}</option>
        </select>
      </label>
      <button
        type="submit"
        class="dispatch-button sm:col-span-2 lg:col-span-1"
        :disabled="store.locked || !store.canAssign"
      >
        {{ tr("Dispatch.start") }}
      </button>
    </div>
    <div v-if="store.selectedNpc" class="flex items-center gap-2 text-xs">
      <span>{{ tr("Dispatch.operatingCost") }}</span
      ><Cash :amount="store.selectedNpc.operating_cash" :size="20" :interactive="false" />
    </div>
    <DispatchRewards
      v-if="store.selectedJob"
      :rewards="store.selectedJob.rewards"
      :delivery-items="store.selectedJob.data.delivery_items"
    />
    <div v-if="store.selectedNpc && store.selectedJob && !store.canAssign" class="text-xs text-gold">
      {{ tr("Dispatch.assignmentHint") }}
    </div>
  </form>
</template>
