<script lang="ts" setup>
import { onMounted } from "vue";
import EventThumbnail from "../../player/event/EventThumbnail.vue";
import EventScheduleForm from "./EventScheduleForm.vue";
import { useAdminEventScheduleStore } from "./admin-event-schedule-store";

const emit = defineEmits(["close"]);
const store = useAdminEventScheduleStore();

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

onMounted(() => store.loadAll());
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col bg-gray-50">
    <header
      class="flex shrink-0 items-center justify-between gap-4 border-b border-emerald-900 bg-[#153221] px-5 py-4 text-white md:px-7"
    >
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-800 text-xl"
        >
          🗓️
        </div>
        <div class="min-w-0">
          <h2 class="m-0 text-lg font-extrabold">Quản lý lịch sự kiện</h2>
          <p class="m-0 text-xs text-emerald-200">{{ store.schedules.length }} lịch trong bảng event_schedule</p>
        </div>
      </div>
      <button
        type="button"
        title="Đóng"
        aria-label="Đóng"
        class="grid size-9 shrink-0 place-items-center rounded-lg border border-emerald-600 bg-emerald-900/50 text-xl hover:bg-emerald-800"
        @click="emit('close')"
      >
        &times;
      </button>
    </header>

    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-3 md:px-7">
      <div class="relative min-w-55 flex-1">
        <input
          v-model="store.search"
          type="search"
          placeholder="Tìm theo tên sự kiện..."
          class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
      </div>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
        Sự kiện
        <select
          v-model="store.eventFilter"
          class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700"
        >
          <option value="ALL">Tất cả</option>
          <option v-for="event in store.eventOptions" :key="event.id" :value="event.id">{{ event.name }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
        Trạng thái
        <select
          v-model="store.statusFilter"
          class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700"
        >
          <option value="ALL">Tất cả</option>
          <option value="ACTIVE">Đang bật</option>
          <option value="DISABLED">Đã tắt</option>
        </select>
      </label>
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden text-xs text-gray-500 sm:inline">{{ store.filteredSchedules.length }} kết quả</span>
        <button
          type="button"
          title="Làm mới danh sách"
          class="grid size-9 place-items-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          :disabled="store.isLoading"
          @click="store.loadAll()"
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
          :disabled="!store.eventOptions.length"
          class="rounded-lg bg-[#153221] px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          @click="store.openCreateForm()"
        >
          + Thêm lịch
        </button>
      </div>
    </div>

    <main class="relative flex min-h-0 flex-1">
      <section class="min-w-0 flex-1 overflow-auto p-4 md:p-6">
        <div
          v-if="store.loadError"
          class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{{ store.loadError }}</span>
          <button type="button" class="font-bold underline" @click="store.loadAll()">Thử lại</button>
        </div>
        <div
          v-if="!store.isLoading && !store.events.length"
          class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
        >
          Chưa có sự kiện nào. Vui lòng tạo sự kiện trước khi thêm lịch.
        </div>
        <div v-if="store.isLoading" class="grid min-h-64 place-items-center text-sm text-gray-500">
          Đang tải danh sách lịch sự kiện...
        </div>
        <div
          v-else-if="!store.filteredSchedules.length"
          class="grid min-h-64 place-items-center text-center text-sm text-gray-500"
        >
          <div>
            <span class="mb-2 block text-3xl">🗓️</span
            >{{ store.schedules.length ? "Không tìm thấy lịch phù hợp." : "Chưa có lịch sự kiện nào." }}
          </div>
        </div>
        <div v-else class="rounded-lg border border-gray-200 bg-white shadow-sm">
          <table class="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead class="text-[11px] uppercase text-gray-600">
              <tr>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Sự kiện</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Bắt đầu</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Kết thúc</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Lượt xem</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Trạng thái</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in store.filteredSchedules"
                :key="item.id"
                class="border-t border-gray-100 hover:bg-emerald-50/40"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <EventThumbnail :src="item.eventThumbnail" :rotate="-8" :width="80" :height="80" />
                    <span class="font-bold text-gray-800">{{ item.eventName || "—" }}</span>
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-gray-700">{{ formatDate(item.start) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-gray-700">{{ formatDate(item.end) }}</td>
                <td class="px-4 py-3 text-gray-700">{{ item.viewCount }}</td>
                <td class="px-4 py-3">
                  <span
                    v-if="!item.isDisabled"
                    class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                    >Đang bật</span
                  >
                  <span
                    v-else
                    class="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600"
                    >Đã tắt</span
                  >
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
                      @click="store.openEditForm(item)"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
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
      <EventScheduleForm />
    </main>

    <div v-if="store.confirmDeleteId" class="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 class="m-0 text-base font-extrabold text-gray-800">Xác nhận xoá lịch sự kiện?</h3>
        <p class="my-3 text-sm text-gray-600">Thao tác này không thể hoàn tác.</p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700"
            @click="store.confirmDeleteId = null"
          >
            Huỷ
          </button>
          <button
            type="button"
            :disabled="store.deletingId === store.confirmDeleteId"
            class="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            @click="store.remove()"
          >
            {{ store.deletingId ? "Đang xoá..." : "Xoá lịch" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
