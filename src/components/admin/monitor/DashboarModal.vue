<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import AdminModal from "../AdminModal.vue";
import UerInAreaReport from "./UerInAreaReport.vue";
import { useAdminMonitorStore } from "./admin-monitor-store";

const emit = defineEmits<{ close: [] }>();
const store = useAdminMonitorStore();

onMounted(store.start);
onUnmounted(store.stop);
</script>

<template>
  <AdminModal
    title="Giám sát bãi câu"
    subtitle="Theo dõi số người đang ở trong bãi và những nơi tập trung đông người chơi."
    icon="📊"
    @close="emit('close')"
  >
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#cbd9c6] bg-white px-4 py-3 sm:px-6">
      <div class="text-xs text-slate-600" aria-live="polite">
        <p class="mb-1 flex items-center gap-2">
          <span
            class="size-2 shrink-0 rounded-full"
            :class="store.realtimeStatus === 'connected' ? 'bg-emerald-600' : 'bg-amber-500'"
            aria-hidden="true"
          />
          {{ store.realtimeLabel }}
        </p>
        <p>Cập nhật: {{ store.lastUpdatedLabel }}</p>
        <p class="mt-1">Cập nhật ngay khi người chơi vào, rời hoặc đổi bãi câu.</p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-4 py-2 text-sm font-semibold text-[#24352a] hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:opacity-50"
        :disabled="store.loading"
        @click="store.refresh()"
      >
        {{ store.loading ? "Đang tải…" : "Tải lại" }}
      </button>
    </div>
    <div class="min-h-0 flex-1 overflow-auto p-4 sm:p-6" :aria-busy="store.loading">
      <p v-if="store.error" role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Không thể cập nhật báo cáo: {{ store.error }}
        <span v-if="store.lastUpdatedAt">Dữ liệu bên dưới là lần tải thành công gần nhất.</span>
      </p>
      <p v-if="store.loading && !store.lastUpdatedAt" role="status" class="py-12 text-center text-sm text-slate-600">
        Đang tải báo cáo người chơi…
      </p>
      <UerInAreaReport v-else-if="store.lastUpdatedAt" />
    </div>
  </AdminModal>
</template>
