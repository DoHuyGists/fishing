<script lang="ts" setup>
import AdminModal from "../AdminModal.vue";
import Pagination from "../../shared/Pagination.vue";
import { usePagedListFilters } from "../../../composables/usePagedListFilters.ts";
import { onMounted } from "vue";
import EventForm from "./EventForm.vue";
import { useAdminEventStore } from "./admin-event-store.ts";

const emit = defineEmits(["close"]);
const store = useAdminEventStore();
usePagedListFilters(
  [() => store.search, () => store.statusFilter],
  () => {
    void store.loadEvents(1);
  },
  () => {
    ++store.requestId;
  },
);

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

onMounted(() => store.loadEvents());
</script>

<template>
  <AdminModal title="Quản lý sự kiện" icon="🎉" @close="emit('close')">
    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-white px-5 py-3 md:px-7">
      <div class="relative min-w-55 flex-1">
        <input
          v-model="store.search"
          type="search"
          placeholder="Tìm tên, mô tả..."
          class="w-full rounded-lg border border-content bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>
      <label class="flex items-center gap-2 text-xs font-semibold text-content">
        Trạng thái
        <select
          v-model="store.statusFilter"
          class="rounded-lg border border-content bg-white px-2.5 py-2 text-sm text-content"
        >
          <option value="ALL">Tất cả</option>
          <option value="ACTIVE">Đang bật</option>
          <option value="DISABLED">Đã tắt</option>
        </select>
      </label>
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden text-xs text-content sm:inline">{{ store.filteredEvents.length }} kết quả</span>
        <button
          type="button"
          title="Làm mới danh sách"
          class="grid size-9 place-items-center rounded-lg border border-content bg-white text-content hover:bg-surface disabled:opacity-50"
          :disabled="store.isLoading"
          @click="store.loadEvents()"
        >
          <svg
            class="size-4"
            :class="{ 'animate-spin': store.isLoading }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
        <button
          type="button"
          class="rounded-lg bg-content-strong px-3.5 py-2 text-sm font-bold text-white hover:bg-accent"
          @click="store.openCreateForm()"
        >
          + Thêm sự kiện
        </button>
      </div>
    </div>

    <main class="relative flex min-h-0 flex-1">
      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <div
          v-if="store.loadError"
          class="mb-4 flex shrink-0 items-center justify-between gap-3 rounded-lg border border-danger bg-surface px-4 py-3 text-sm text-danger"
        >
          <span>{{ store.loadError }}</span>
          <button type="button" class="font-bold underline" @click="store.loadEvents()">Thử lại</button>
        </div>
        <div v-if="store.isLoading" class="grid min-h-64 place-items-center text-sm text-content">
          Đang tải danh sách sự kiện...
        </div>
        <div
          v-else-if="!store.filteredEvents.length"
          class="grid min-h-64 place-items-center text-center text-sm text-content"
        >
          <div>
            <span class="mb-2 block text-3xl">🎉</span
            >{{ store.events.length ? "Không tìm thấy sự kiện phù hợp." : "Chưa có sự kiện nào." }}
          </div>
        </div>
        <div v-else class="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-white shadow-sm">
          <table class="w-full min-w-[950px] border-collapse text-left text-sm">
            <thead class="text-[11px] uppercase text-content">
              <tr>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Sự kiện</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Trạng thái</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Ngày tạo</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Cập nhật</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in store.filteredEvents"
                :key="item.id"
                class="border-t border-border hover:bg-surface/40"
              >
                <td class="max-w-[28rem] px-4 py-3">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="item.image"
                      :src="item.image"
                      :alt="item.name"
                      class="shrink-0 rounded-md border border-border bg-white object-cover"
                      loading="lazy"
                    />
                    <div
                      v-else
                      class="grid size-12 shrink-0 place-items-center rounded-md border border-border bg-white text-xl"
                    >
                      {{ item.thumbnail || "🎉" }}
                    </div>
                    <div class="min-w-0">
                      <div class="truncate font-bold text-content" :title="item.name">{{ item.name }}</div>
                      <div class="mt-1 max-w-[24rem] truncate text-xs text-content" :title="item.description || ''">
                        {{ item.description || "Chưa có mô tả" }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span
                    v-if="!item.is_disabled"
                    class="rounded-full border border-accent bg-surface px-2.5 py-1 text-xs font-semibold text-content"
                    >Đang bật</span
                  >
                  <span
                    v-else
                    class="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-content"
                    >Đã tắt</span
                  >
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-content">{{ formatDate(item.created_at) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-content">{{ formatDate(item.updated_at) }}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-md border border-content px-2.5 py-1.5 text-xs font-bold text-content hover:bg-surface"
                      @click="store.openEditForm(item)"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      class="rounded-md border border-danger px-2.5 py-1.5 text-xs font-bold text-danger hover:bg-surface"
                      @click="store.confirmDeleteId = item.id"
                    >
                      Xoá
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
    <EventForm />

    <div v-if="store.confirmDeleteId" class="fixed inset-0 z-40 grid place-items-center bg-content/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div class="m-0 text-base font-extrabold text-content">Xác nhận xoá sự kiện?</div>
        <div class="my-3 text-sm text-content">
          Thao tác này không thể hoàn tác. Các lịch sự kiện liên quan có thể bị ràng buộc bởi cơ sở dữ liệu.
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-content px-3 py-2 text-sm font-bold text-content"
            @click="store.confirmDeleteId = null"
          >
            Huỷ
          </button>
          <button
            type="button"
            :disabled="store.deletingId === store.confirmDeleteId"
            class="rounded-lg bg-danger px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            @click="store.remove()"
          >
            {{ store.deletingId ? "Đang xoá..." : "Xoá sự kiện" }}
          </button>
        </div>
      </div>
    </div>
    <Pagination
      :page="store.page"
      :page-size="store.pageSize"
      :total="store.total"
      :loading="store.isLoading"
      @change="store.loadEvents($event)"
    />
  </AdminModal>
</template>
