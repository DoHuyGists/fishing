<script setup lang="ts">
import AdminModal from "../AdminModal.vue";
import Pagination from "../../shared/Pagination.vue";
import { usePagedListFilters } from "../../../composables/usePagedListFilters.ts";
import { onMounted, onUnmounted } from "vue";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";
import DailyMissionRewardForm from "./DailyMissionRewardForm.vue";
import { useAdminDailyMissionRewardStore } from "./admin-daily-mission-rewards-store.ts";

const emit = defineEmits<{ close: [] }>();
const store = useAdminDailyMissionRewardStore();
usePagedListFilters(
  [() => store.search, () => store.statusFilter],
  () => {
    void store.load(1);
  },
  () => {
    ++store.requestId;
  },
);
function close() {
  if (!store.isSaving && !store.isDeleting) {
    store.closeForm();
    store.confirmDeleteId = null;
    emit("close");
  }
}
const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
onMounted(() => {
  store.closeForm();
  store.confirmDeleteId = null;
  void store.load();
});
onUnmounted(() => {
  store.isFormOpen = false;
  store.confirmDeleteId = null;
});
</script>

<template>
  <AdminModal
    title="Quản lý phần thưởng hằng ngày"
    icon="🎁"
    :close-disabled="store.isSaving || store.isDeleting"
    @close="close"
  >
    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-white px-5 py-3 md:px-7">
      <input
        v-model="store.search"
        type="search"
        aria-label="Tìm kiếm"
        placeholder="Tìm theo mốc điểm..."
        class="min-w-48 flex-1 rounded-lg border border-content bg-white px-3 py-2.5 text-sm placeholder:text-content focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
      />
      <label class="flex items-center gap-2 text-sm text-content">
        Trạng thái
        <select
          v-model="store.statusFilter"
          class="rounded-lg border border-content bg-white px-3 py-2.5 text-sm text-content focus:border-accent focus:outline-none"
        >
          <option value="ALL">Tất cả</option>
          <option value="ACTIVE">Đang bật</option>
          <option value="INACTIVE">Đã tắt</option>
        </select>
      </label>
      <span class="text-sm text-content">{{ store.filteredItems.length }} kết quả</span>
      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          title="Làm mới danh sách"
          aria-label="Làm mới danh sách"
          :disabled="store.isLoading || store.isSaving || store.isDeleting"
          class="grid size-10 place-items-center rounded-lg border border-content bg-white text-content hover:bg-white focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
          @click="store.load()"
        >
          <svg
            class="size-4"
            :class="{ 'animate-spin': store.isLoading }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 4v5h5m11 11v-5h-5M4.6 9a8 8 0 0 1 13.2-5L20 6M4 18l2.2 2A8 8 0 0 0 19.4 15"
            />
          </svg>
        </button>
        <button
          type="button"
          class="rounded-lg bg-content-strong px-4 py-2.5 text-sm font-bold text-white hover:bg-accent focus-visible:outline-2 focus-visible:outline-accent"
          @click="store.openCreateForm()"
        >
          + Thêm mốc thưởng
        </button>
      </div>
    </div>
    <div v-if="store.loadError" role="alert" class="m-4 rounded-lg bg-surface p-3 text-danger">
      {{ store.loadError }}
    </div>
    <main class="min-h-0 flex-1 overflow-auto p-4 md:p-6">
      <div v-if="store.isLoading" role="status" class="grid min-h-56 place-items-center text-sm text-content">
        Đang tải danh sách...
      </div>
      <div v-else class="h-full overflow-auto rounded-lg border border-border bg-white shadow-sm">
        <table class="w-full min-w-[1000px] border-separate border-spacing-0 text-left text-sm">
          <thead class="sticky top-0 z-10 bg-surface text-xs font-medium uppercase text-content">
            <tr>
              <th class="whitespace-nowrap px-5 py-4">Mốc điểm</th>
              <th class="whitespace-nowrap px-5 py-4">Phần thưởng</th>
              <th class="whitespace-nowrap px-5 py-4">Trạng thái</th>
              <th class="whitespace-nowrap px-5 py-4">Ngày tạo</th>
              <th class="whitespace-nowrap px-5 py-4">Cập nhật</th>
              <th class="whitespace-nowrap px-5 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in store.filteredItems"
              :key="item.id"
              class="align-top transition-colors hover:bg-surface/40"
            >
              <td class="max-w-sm px-5 py-4">
                <span class="font-semibold text-content"
                  >{{ item.required_points.toLocaleString("vi-VN") }} điểm</span
                >
              </td>
              <td class="max-w-sm px-5 py-4">
                <pre
                  class="max-h-28 min-w-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-white px-3 py-2 font-mono text-xs leading-relaxed text-content"
                  >{{ JSON.stringify(item.reward_data, null, 2) }}</pre
                >
              </td>
              <td class="whitespace-nowrap px-5 py-4">
                <span
                  class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                  :class="
                    item.is_active
                      ? 'border-accent bg-surface text-content'
                      : 'border-border bg-surface text-content'
                  "
                  >{{ item.is_active ? "Đang bật" : "Đã tắt" }}</span
                >
              </td>
              <td class="whitespace-nowrap px-5 py-4 text-xs text-content">{{ formatDate(item.created_at) }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-xs text-content">{{ formatDate(item.updated_at) }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-right">
                <button
                  type="button"
                  class="rounded-md border border-content px-3 py-2 text-xs font-medium text-content hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
                  @click="store.openEditForm(item)"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  class="ml-2 rounded-md border border-danger px-3 py-2 text-xs font-medium text-danger hover:bg-surface focus-visible:outline-2 focus-visible:outline-danger"
                  @click="store.confirmDeleteId = item.id"
                >
                  Xoá
                </button>
              </td>
            </tr>
            <tr v-if="!store.filteredItems.length">
              <td colspan="6" class="p-12 text-center text-sm text-content">Không có bản ghi phù hợp.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
    <DailyMissionRewardForm />
    <TwoOptionsModal
      v-if="store.confirmDeleteId"
      title="Xác nhận xoá bản ghi?"
      message="Bản ghi sẽ bị xoá vĩnh viễn."
      :first-disabled="store.isDeleting"
      :second-disabled="store.isDeleting"
      :second-text="store.isDeleting ? 'Đang xoá...' : 'Xoá'"
      :on-first="
        () => {
          store.confirmDeleteId = null;
        }
      "
      :on-second="store.remove"
    >
      <div>Bản ghi sẽ bị xoá vĩnh viễn.</div>
      <div v-if="store.loadError" role="alert" class="mt-2 text-danger">{{ store.loadError }}</div>
    </TwoOptionsModal>
    <Pagination
      :page="store.page"
      :page-size="store.pageSize"
      :total="store.total"
      :loading="store.isLoading"
      @change="store.load($event)"
    />
  </AdminModal>
</template>
