<script setup lang="ts">
import { t as tr } from "../../../i18n";
import { dispatchText } from "../../../data/dispatch";
import { formatDateTime } from "../../../utils/time";
import { useDispatchStore } from "../../../stores/player-dispatch-store.ts";
import Pagination from "../../shared/Pagination.vue";
import Cash from "../player-currency/Cash.vue";
import DispatchRewards from "./DispatchRewards.vue";
const store = useDispatchStore();
</script>

<template>
  <div v-if="store.historyError" role="alert" class="mb-3 text-sm text-danger">
    {{ store.historyError }}
    <button type="button" class="underline" @click="store.fetchHistory(store.historyPage)">
      {{ tr("Dispatch.retry") }}
    </button>
  </div>
  <div v-if="store.historyLoading" role="status" class="py-4 text-center text-sm">{{ tr("Dispatch.loading") }}</div>
  <div v-else-if="!store.history.length && !store.historyError" class="py-8 text-center text-sm">
    {{ tr("Dispatch.emptyHistory") }}
  </div>
  <div class="dispatch-grid">
    <article v-for="(record, index) in store.history" :key="record.id" class="dispatch-card slide-fade-in from-bottom player-content-in" :style="{ '--delay': `${index * 45}ms` }">
      <div class="font-bold">
        {{ dispatchText(record.npc_snapshot.name) }} · {{ dispatchText(record.job_snapshot.name) }}
      </div>
      <div :class="record.outcome === 'cancelled' ? 'text-danger' : 'text-content'">
        {{ record.outcome === "cancelled" ? tr("Dispatch.cancelled") : tr("Dispatch.claimed") }}
      </div>
      <div>{{ tr("Dispatch.startedAt") }}: {{ formatDateTime(record.started_at) }}</div>
      <div>{{ tr("Dispatch.endsAt") }}: {{ formatDateTime(record.ends_at) }}</div>
      <div>{{ tr("Dispatch.resolvedAt") }}: {{ formatDateTime(record.resolved_at) }}</div>
      <div class="flex items-center gap-2">
        <span>{{ tr("Dispatch.operatingCost") }}</span
        ><Cash :amount="record.operating_cash" :size="20" :interactive="false" />
      </div>
      <DispatchRewards :rewards="record.rewards" :delivery-items="record.outcome === 'claimed' ? record.job_snapshot.data.delivery_items : undefined" />
    </article>
  </div>
  <Pagination
    :page="store.historyPage"
    :total="store.historyTotal"
    :page-size="store.historyPageSize"
    :loading="store.historyLoading"
    @change="store.fetchHistory"
  />
</template>
