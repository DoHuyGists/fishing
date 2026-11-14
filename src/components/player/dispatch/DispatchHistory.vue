<script setup lang="ts">
import { t as tr } from '../../../i18n';
import { dispatchText } from '../../../data/dispatch';
import { formatDateTime } from '../../../utils/time';
import { useDispatchStore } from '../../../stores/dispatch';
import Pagination from '../../shared/Pagination.vue';
import Cash from '../currency/Cash.vue';
import DispatchRewards from './DispatchRewards.vue';
const store = useDispatchStore();
</script>

<template>
  <div v-if="store.historyError" role="alert" class="mb-3 text-sm text-red-700">{{ store.historyError }} <button type="button" class="underline" @click="store.fetchHistory(store.historyPage)">{{ tr('Dispatch.retry') }}</button></div>
  <div v-if="store.historyLoading" role="status" class="py-4 text-center text-sm">{{ tr('Dispatch.loading') }}</div>
  <div v-else-if="!store.history.length && !store.historyError" class="py-8 text-center text-sm">{{ tr('Dispatch.emptyHistory') }}</div>
  <div class="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
    <article v-for="record in store.history" :key="record.id" class="dispatch-card">
      <div class="font-bold">{{ dispatchText(record.npc_snapshot.name) }} · {{ dispatchText(record.job_snapshot.name) }}</div>
      <div :class="record.outcome === 'cancelled' ? 'text-red-700' : 'text-emerald-800'">{{ record.outcome === 'cancelled' ? tr('Dispatch.cancelled') : tr('Dispatch.claimed') }}</div>
      <div>{{ tr('Dispatch.startedAt') }}: {{ formatDateTime(record.started_at) }}</div>
      <div>{{ tr('Dispatch.endsAt') }}: {{ formatDateTime(record.ends_at) }}</div>
      <div>{{ tr('Dispatch.resolvedAt') }}: {{ formatDateTime(record.resolved_at) }}</div>
      <div class="flex items-center gap-2"><span>{{ tr('Dispatch.operatingCost') }}</span><Cash :amount="record.operating_cash" :size="20" :interactive="false" /></div>
      <DispatchRewards :rewards="record.rewards" />
    </article>
  </div>
  <Pagination :page="store.historyPage" :total="store.historyTotal" :page-size="store.historyPageSize" :loading="store.historyLoading" @change="store.fetchHistory" />
</template>
