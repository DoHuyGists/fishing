<script setup lang="ts">
import { onMounted } from "vue";
import NotificationForm from "./NotificationForm.vue";
import { useAdminNotificationStore } from "./admin-notification-store";

const emit = defineEmits(["close"]);
const store = useAdminNotificationStore();

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}
onMounted(() => store.fetchRows());
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
          🔔
        </div>
        <div>
          <h2 class="m-0 text-lg font-extrabold">Quản lý thông báo</h2>
          <p class="m-0 text-xs text-emerald-200">{{ store.rows.length }} thông báo</p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Đóng"
        class="grid size-9 place-items-center rounded-lg border border-emerald-600 bg-emerald-900/50 text-xl hover:bg-emerald-800"
        @click="emit('close')"
      >
        &times;
      </button>
    </header>
    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-3 md:px-7">
      <div class="flex rounded-lg bg-gray-100 p-1">
        <button
          v-for="item in [
            { id: 'system', label: 'Hệ thống' },
            { id: 'personal', label: 'Cá nhân' },
          ] as const"
          :key="item.id"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-bold"
          :class="store.tab === item.id ? 'bg-white text-emerald-900 shadow-sm' : 'text-gray-600'"
          @click="store.changeTab(item.id)"
        >
          {{ item.label }}
        </button>
      </div>
      <input
        v-model="store.search"
        type="search"
        placeholder="Tìm thông báo..."
        class="min-w-48 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
      />
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        :disabled="store.loading"
        @click="store.fetchRows()"
      >
        Làm mới
      </button>
      <button
        type="button"
        class="rounded-lg bg-[#153221] px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-800"
        @click="store.openCreate()"
      >
        + Tạo thông báo
      </button>
    </div>
    <main class="min-h-0 flex-1 overflow-auto p-4 md:p-6">
      <p
        v-if="store.error"
        role="alert"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ store.error }}
      </p>
      <div v-if="store.loading" class="grid min-h-64 place-items-center text-sm text-gray-500">
        Đang tải thông báo...
      </div>
      <div
        v-else-if="!store.filteredRows.length"
        class="grid min-h-64 place-items-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500"
      >
        Chưa có thông báo nào.
      </div>
      <div v-else class="overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table class="w-full min-w-220 border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr class="text-[11px] uppercase text-gray-600">
              <th class="sticky top-0 bg-gray-100 px-4 py-3">Tiêu đề</th>
              <th class="sticky top-0 bg-gray-100 px-4 py-3">Nội dung</th>
              <th v-if="store.tab === 'personal'" class="sticky top-0 bg-gray-100 px-4 py-3">User ID</th>
              <th class="sticky top-0 bg-gray-100 px-4 py-3">Loại</th>
              <th class="sticky top-0 bg-gray-100 px-4 py-3">Ngày tạo</th>
              <th class="sticky top-0 bg-gray-100 px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in store.filteredRows"
              :key="item.id"
              class="border-t border-gray-100 hover:bg-emerald-50/40"
            >
              <td class="max-w-64 px-4 py-3 font-bold text-gray-800">{{ item.title }}</td>
              <td class="max-w-96 px-4 py-3">
                <p class="line-clamp-2 whitespace-pre-wrap text-gray-600">{{ item.body }}</p>
              </td>
              <td v-if="store.tab === 'personal'" class="max-w-56 break-all px-4 py-3 font-mono text-xs text-gray-500">
                {{ item.user_id }}
              </td>
              <td class="px-4 py-3">
                <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{{
                  item.type || (store.tab === "system" ? "system" : "general")
                }}</span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{{ formatDate(item.created_at) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
                    @click="store.openEdit(item)"
                  >
                    Sửa</button
                  ><button
                    type="button"
                    class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                    @click="store.deleting = item"
                  >
                    Xóa
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
    <NotificationForm />
    <div v-if="store.deleting" class="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 class="m-0 text-base font-extrabold text-gray-800">Xóa thông báo?</h3>
        <p class="my-3 text-sm text-gray-600">{{ store.deleting.title }}</p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700"
            @click="store.deleting = null"
          >
            Hủy</button
          ><button
            type="button"
            class="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white"
            @click="store.removeNotice()"
          >
            Xóa
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
