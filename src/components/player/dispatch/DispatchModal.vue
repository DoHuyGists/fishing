<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { t as tr } from '../../../i18n';
import { useDispatchStore } from '../../../stores/dispatch';
import { useAuthStore } from '../../../stores/auth';
import Modal from '../../shared/Modal.vue';
import Tab from '../../shared/Tab.vue';
import DispatchAssignment from './DispatchAssignment.vue';
import DispatchNpcList from './DispatchNpcList.vue';
import DispatchJobList from './DispatchJobList.vue';
import DispatchRunList from './DispatchRunList.vue';
import DispatchHistory from './DispatchHistory.vue';
import DispatchConfirmation from './DispatchConfirmation.vue';

const store = useDispatchStore();
const auth = useAuthStore();
const tabs = computed(() => [
  { key: 'npcs', label: tr('Dispatch.npcs'), badge: store.owned.length },
  { key: 'jobs', label: tr('Dispatch.jobs') },
  { key: 'runs', label: tr('Dispatch.runs'), badge: store.runs.length },
  { key: 'history', label: tr('Dispatch.history') },
]);
watch(() => auth.sessionGeneration, () => { void store.initialize(auth.user?.id ?? ''); }, { immediate: true, flush: 'post' });
watch(() => store.tab, tab => { if (tab === 'history') void store.fetchHistory(); });
async function refresh() {
  await store.refresh();
  if (store.tab === 'history') await store.fetchHistory(store.historyPage);
}
function onVisibility() {
  if (!document.hidden) { store.updateClock(); void refresh(); }
}
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => { if (!document.hidden) store.updateClock(); }, 1000);
  document.addEventListener('visibilitychange', onVisibility);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<template>
  <Modal :title="tr('Dispatch.title')" :sub-title="tr('Dispatch.subtitle')" :on-refresh="refresh" role="dialog" aria-modal="true" :aria-label="tr('Dispatch.title')">
    <div class="dispatch-content w-full min-w-0 space-y-2 bg-[#f5f9f0] p-2 text-xs text-[#24352a]">
      <div class="text-xs text-[#61745d]">{{ tr('Dispatch.rules') }}</div>
      <div v-if="store.error" role="alert" class="rounded-lg border border-red-200 bg-white p-3 text-sm text-red-700">{{ store.error }}</div>
      <button v-if="store.pending" type="button" class="dispatch-button" :disabled="store.busy" @click="store.retryPending">{{ tr('Dispatch.retry') }}</button>
      <div v-if="store.loading" role="status" class="text-sm">{{ tr('Dispatch.loading') }}</div>
      <template v-if="store.snapshot">
        <DispatchAssignment />
        <Tab v-model="store.tab" :tabs="tabs" :aria-label="tr('Dispatch.title')">
          <template #npcs><DispatchNpcList /></template>
          <template #jobs><DispatchJobList /></template>
          <template #runs><DispatchRunList /></template>
          <template #history><DispatchHistory /></template>
        </Tab>
      </template>
      <DispatchConfirmation />
    </div>
  </Modal>
</template>

<style>
@reference 'tailwindcss';
.dispatch-button {
  @apply min-h-8 rounded-md border border-[#cbd9c6] bg-[#24352a] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#3d5941] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527547] disabled:cursor-not-allowed disabled:opacity-50;
}
.dispatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: 0.5rem;
}
.dispatch-card {
  @apply min-w-0 space-y-2 rounded-lg border border-[#cbd9c6] bg-white p-2.5 text-xs;
  overflow-wrap: anywhere;
}
.dispatch-content [role='tablist'] > button {
  @apply gap-1.5 px-3 py-2 text-xs;
}
.dispatch-content [role='tabpanel'] {
  @apply py-2;
}
</style>
