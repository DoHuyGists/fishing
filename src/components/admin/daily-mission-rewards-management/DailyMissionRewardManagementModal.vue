<script setup lang="ts">
import AdminModal from "../AdminModal.vue";
import Pagination from '../../shared/Pagination.vue';
import { usePagedListFilters } from '../../../composables/usePagedListFilters';
import { onMounted, onUnmounted } from "vue";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";
import DailyMissionRewardForm from "./DailyMissionRewardForm.vue";
import { useAdminDailyMissionRewardStore } from "./admin-daily-mission-rewards-store";

const emit = defineEmits<{ close: [] }>();
const store = useAdminDailyMissionRewardStore();
usePagedListFilters([() => store.search, () => store.statusFilter], () => { void store.load(1); }, () => { ++store.requestId; });
function close() {
  if (!store.isSaving && !store.isDeleting) { store.closeForm(); store.confirmDeleteId = null; emit("close"); }
}
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString("vi-VN") : "—";
onMounted(() => { store.closeForm(); store.confirmDeleteId = null; void store.load(); });
onUnmounted(() => { store.isFormOpen = false; store.confirmDeleteId = null; });
</script>

<template>
  <AdminModal
    title="Quản lý phần thưởng hằng ngày"
    icon="🎁"
    :close-disabled="store.isSaving || store.isDeleting"
    @close="close"
  >
    <template #subtitle>{{ store.items.length }} mốc thưởng trong danh sách</template>
    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-3 md:px-7">
      <input v-model="store.search" type="search" aria-label="Tìm kiếm" placeholder="Tìm theo mốc điểm..." class="min-w-48 flex-1 rounded-lg border border-slate-300 bg-gray-50 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15" />
      <label class="flex items-center gap-2 text-sm text-slate-600">
        Trạng thái
        <select v-model="store.statusFilter" class="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none">
          <option value="ALL">Tất cả</option><option value="ACTIVE">Đang bật</option><option value="INACTIVE">Đã tắt</option>
        </select>
      </label>
      <span class="text-sm text-slate-500">{{ store.filteredItems.length }} kết quả</span>
      <div class="ml-auto flex items-center gap-2">
        <button type="button" title="Làm mới danh sách" aria-label="Làm mới danh sách" :disabled="store.isLoading || store.isSaving || store.isDeleting" class="grid size-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50" @click="store.load()">
          <svg class="size-4" :class="{ 'animate-spin': store.isLoading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5m11 11v-5h-5M4.6 9a8 8 0 0 1 13.2-5L20 6M4 18l2.2 2A8 8 0 0 0 19.4 15" /></svg>
        </button>
        <button type="button" class="rounded-lg bg-[#153221] px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-600" @click="store.openCreateForm()">+ Thêm mốc thưởng</button>
      </div>
    </div>
    <div v-if="store.loadError" role="alert" class="m-4 rounded-lg bg-red-50 p-3 text-red-700">{{ store.loadError }}</div>
    <main class="min-h-0 flex-1 overflow-auto p-4 md:p-6">
      <div v-if="store.isLoading" role="status" class="grid min-h-56 place-items-center text-sm text-slate-500">Đang tải danh sách...</div>
      <div v-else class="h-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table class="w-full min-w-[1000px] border-separate border-spacing-0 text-left text-sm">
        <thead class="sticky top-0 z-10 bg-gray-100 text-xs font-medium uppercase text-slate-600"><tr>
          <th class="whitespace-nowrap px-5 py-4">Mốc điểm</th>
<th class="whitespace-nowrap px-5 py-4">Phần thưởng</th>
          <th class="whitespace-nowrap px-5 py-4">Trạng thái</th><th class="whitespace-nowrap px-5 py-4">Ngày tạo</th><th class="whitespace-nowrap px-5 py-4">Cập nhật</th><th class="whitespace-nowrap px-5 py-4 text-right">Thao tác</th>
        </tr></thead>
        <tbody>
          <tr v-for="item in store.filteredItems" :key="item.id" class="align-top transition-colors hover:bg-emerald-50/40">
            <td class="max-w-sm px-5 py-4"><span class="font-semibold text-emerald-800">{{ item.required_points.toLocaleString("vi-VN") }} điểm</span></td>
<td class="max-w-sm px-5 py-4"><pre class="max-h-28 min-w-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-600">{{ JSON.stringify(item.reward_data, null, 2) }}</pre></td>
            <td class="whitespace-nowrap px-5 py-4"><span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium" :class="item.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-100 text-gray-500'">{{ item.is_active ? "Đang bật" : "Đã tắt" }}</span></td>
            <td class="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{{ formatDate(item.created_at) }}</td><td class="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{{ formatDate(item.updated_at) }}</td>
            <td class="whitespace-nowrap px-5 py-4 text-right">
              <button type="button" class="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-emerald-600" @click="store.openEditForm(item)">Sửa</button>
              <button type="button" class="ml-2 rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500" @click="store.confirmDeleteId = item.id">Xoá</button>
            </td>
          </tr>
          <tr v-if="!store.filteredItems.length"><td colspan="6" class="p-12 text-center text-sm text-slate-500">Không có bản ghi phù hợp.</td></tr>
        </tbody>
      </table>
      </div>
    </main>
    <DailyMissionRewardForm />
    <TwoOptionsModal v-if="store.confirmDeleteId" title="Xác nhận xoá bản ghi?" message="Bản ghi sẽ bị xoá vĩnh viễn." :first-disabled="store.isDeleting" :second-disabled="store.isDeleting" :second-text="store.isDeleting ? 'Đang xoá...' : 'Xoá'" :on-first="() => { store.confirmDeleteId = null; }" :on-second="store.remove">
      <div>Bản ghi sẽ bị xoá vĩnh viễn.</div>
      <div v-if="store.loadError" role="alert" class="mt-2 text-red-700">{{ store.loadError }}</div>
    </TwoOptionsModal>
    <Pagination :page="store.page" :page-size="store.pageSize" :total="store.total" :loading="store.isLoading" @change="store.load($event)" />
  </AdminModal>
</template>
