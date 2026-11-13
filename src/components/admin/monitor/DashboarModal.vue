<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import AdminModal from "../AdminModal.vue";
import UerInAreaReport from "./UerInAreaReport.vue";
import UserCurrencyReport from "./UserCurrencyReport.vue";
import Tab from "../../shared/Tab.vue";
import { useAdminMonitorStore } from "./admin-monitor-store";

const emit = defineEmits<{ close: [] }>();
const store = useAdminMonitorStore();
const tabs = [
  { key: "areas", label: "Người chơi trong bãi" },
  { key: "currency", label: "Tiền tệ thế giới" },
];

onMounted(store.start);
onUnmounted(store.stop);
</script>

<template>
  <AdminModal
    title="Giám sát thế giới"
    subtitle="Theo dõi người chơi trong bãi câu và tổng tiền tệ của thế giới."
    icon="📊"
    @close="emit('close')"
  >
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#cbd9c6] bg-white px-4 py-3 sm:px-6">
      <div class="text-xs text-slate-600" aria-live="polite">
        <div class="mb-1 flex items-center gap-2">
          <span
            class="size-2 shrink-0 rounded-full"
            :class="store.error || store.currencyError ? 'bg-amber-500' : 'bg-emerald-600'"
            aria-hidden="true"
          />
          Tự động tải báo cáo đang xem mỗi 30 giây
        </div>
        <div>Cập nhật: {{ store.activeReport === 'currency' ? store.currencyUpdatedLabel : store.lastUpdatedLabel }}</div>
        <div class="mt-1">Tạm dừng tải tự động khi tab ẩn hoặc mất mạng.</div>
      </div>
      <button
        type="button"
        class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2 text-sm font-semibold text-[#24352a] hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:opacity-50"
        :disabled="store.reportLoading"
        @click="store.refresh()"
      >
        {{ store.reportLoading ? "Đang tải…" : "Tải lại" }}
      </button>
    </div>
    <div class="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
      <Tab v-model="store.activeReport" :tabs="tabs" lazy aria-label="Báo cáo giám sát thế giới">
        <template #areas>
          <div :aria-busy="store.loading">
            <div v-if="store.error" role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Không thể cập nhật báo cáo: {{ store.error }}
              <span v-if="store.lastUpdatedAt">Dữ liệu bên dưới là lần tải thành công gần nhất.</span>
            </div>
            <div v-if="store.loading && !store.lastUpdatedAt" role="status" class="py-12 text-center text-sm text-slate-600">Đang tải báo cáo người chơi…</div>
            <UerInAreaReport v-else-if="store.lastUpdatedAt" />
          </div>
        </template>
        <template #currency>
          <div :aria-busy="store.currencyLoading">
            <div v-if="store.currencyError" role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Không thể cập nhật báo cáo tiền tệ: {{ store.currencyError }}
              <span v-if="store.currencyUpdatedAt">Dữ liệu bên dưới là lần tải thành công gần nhất.</span>
            </div>
            <div v-if="store.currencyLoading && !store.currencyUpdatedAt" role="status" class="py-12 text-center text-sm text-slate-600">Đang tải báo cáo tiền tệ…</div>
            <UserCurrencyReport v-else-if="store.currencyUpdatedAt" />
          </div>
        </template>
      </Tab>
    </div>
  </AdminModal>
</template>
