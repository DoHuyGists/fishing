<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { t as tr } from "../../../i18n/index.ts";
import { useDispatchStore } from "../../../stores/player-dispatch-store.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import Modal from "../../shared/Modal.vue";
import Tab from "../../shared/Tab.vue";
import DispatchAssignment from "./DispatchAssignment.vue";
import DispatchNpcList from "./DispatchNpcList.vue";
import DispatchJobList from "./DispatchJobList.vue";
import DispatchRunList from "./DispatchRunList.vue";
import DispatchHistory from "./DispatchHistory.vue";
import DispatchConfirmation from "./DispatchConfirmation.vue";

const store = useDispatchStore();
const auth = useAuthStore();
const tabs = computed(() => [
  { key: "npcs", label: tr("Dispatch.npcs"), badge: store.owned.length },
  { key: "jobs", label: tr("Dispatch.jobs") },
  { key: "runs", label: tr("Dispatch.runs"), badge: store.runs.length },
  { key: "history", label: tr("Dispatch.history") },
]);
watch(
  () => auth.sessionGeneration,
  () => {
    void store.initialize(auth.user?.id ?? "");
  },
  { immediate: true, flush: "post" },
);
watch(
  () => store.tab,
  (tab) => {
    if (tab === "history") void store.fetchHistory();
  },
);
async function refresh() {
  await store.refresh();
  if (store.tab === "history") await store.fetchHistory(store.historyPage);
}
function onVisibility() {
  if (!document.hidden) {
    store.updateClock();
    void refresh();
  }
}
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    if (!document.hidden) store.updateClock();
  }, 1000);
  document.addEventListener("visibilitychange", onVisibility);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<template>
  <Modal
    :title="tr('Dispatch.title')"
    :on-refresh="refresh"
    role="dialog"
    aria-modal="true"
    :aria-label="tr('Dispatch.title')"
  >
    <div class="dispatch-content mx-auto w-full max-w-384 min-w-0 space-y-4 p-1 text-sm text-content sm:p-3">
      <div v-if="store.error" role="alert" class="rounded-lg border border-danger bg-white p-3 text-sm text-danger">
        {{ store.error }}
      </div>
      <button
        v-if="store.pending"
        type="button"
        class="dispatch-button"
        :disabled="store.busy"
        @click="store.retryPending"
      >
        {{ tr("Dispatch.retry") }}
      </button>
      <div v-if="store.loading" role="status" class="text-sm">{{ tr("Dispatch.loading") }}</div>
      <template v-if="store.snapshot">
        <div class="grid items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside class="min-w-0 space-y-3 lg:sticky lg:top-0">
            <DispatchAssignment />
            <details class="rounded-xl border border-border-default bg-surface p-4 text-xs leading-relaxed">
              <summary class="cursor-pointer font-semibold">{{ tr("Dispatch.rulesTitle") }}</summary>
              <div class="mt-3">{{ tr("Dispatch.rules") }}</div>
            </details>
          </aside>
          <Tab v-model="store.tab" class="min-w-0" :tabs="tabs" :aria-label="tr('Dispatch.title')">
            <template #npcs><DispatchNpcList /></template>
            <template #jobs><DispatchJobList /></template>
            <template #runs><DispatchRunList /></template>
            <template #history><DispatchHistory /></template>
          </Tab>
        </div>
      </template>
      <DispatchConfirmation />
    </div>
  </Modal>
</template>

<style>
@reference 'tailwindcss';
.dispatch-button {
  @apply min-h-10 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50;
}
.dispatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: 1rem;
  grid-auto-rows: max-content;
}
.dispatch-card {
  @apply flex min-w-0 flex-col gap-4 rounded-xl border border-[var(--color-border-default)] bg-white p-4 text-sm text-[var(--color-content)];
  overflow-wrap: anywhere;
}
.dispatch-content [role="tablist"] > button {
  @apply gap-2 px-4 py-3 text-sm;
}
.dispatch-content [role="tabpanel"] {
  @apply h-auto py-4;
}

html.ocean-theme .dispatch-button {
  border-color: var(--color-ocean-gold);
  background: var(--color-gold);
  color: var(--color-content);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--color-surface) 40%, transparent),
    0 2px 0 var(--color-ocean-wood);
}

html.ocean-theme .dispatch-button:not(:disabled):hover {
  background: var(--color-ocean-gold);
}

html.ocean-theme .dispatch-card {
  background: var(--color-white);
}

.dispatch-content .ocean-currency-chip {
  padding: 0;
  color: var(--color-content);
  background: transparent;
  border: 0;
  box-shadow: none;
  font-weight: 600;
}

.dispatch-content .ocean-currency-chip img {
  width: 1.25rem;
}
</style>
