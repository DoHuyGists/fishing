<script lang="ts" setup>
import { onMounted } from "vue";
import type { RedeemCodeRow } from "../../../data/supabaseRedeemCodeRepository";
import RedeemCodeDeleteModal from "./RedeemCodeDeleteModal.vue";
import RedeemCodeFormModal from "./RedeemCodeFormModal.vue";
import { isRedeemCodeExpired, useAdminRedeemCodeStore } from "./admin-redeem-code-store";

const emit = defineEmits(["close"]);
const store = useAdminRedeemCodeStore();

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "Không hết hạn";
}

const isExpired = (item: RedeemCodeRow) => isRedeemCodeExpired(item);

onMounted(() => store.loadCodes());
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
          🎟️
        </div>
        <div class="min-w-0">
          <h2 class="m-0 text-lg font-extrabold">Quản lý mã đổi thưởng</h2>
          <p class="m-0 text-xs text-emerald-200">{{ store.codes.length }} mã trong danh sách</p>
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
      <div class="min-w-55 flex-1">
        <input
          v-model="store.search"
          type="search"
          placeholder="Tìm mã đổi thưởng..."
          class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
      </div>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600"
        >Trạng thái
        <select
          v-model="store.statusFilter"
          class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700"
        >
          <option value="ALL">Tất cả</option>
          <option value="ACTIVE">Đang bật</option>
          <option value="DISABLED">Đang tắt</option>
          <option value="EXPIRED">Đã hết hạn</option>
        </select>
      </label>
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden text-xs text-gray-500 sm:inline">{{ store.filteredCodes.length }} kết quả</span>
        <button
          type="button"
          title="Làm mới danh sách"
          class="grid size-9 place-items-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          :disabled="store.isLoading"
          @click="store.loadCodes()"
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
          class="rounded-lg bg-[#153221] px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-800"
          @click="store.openCreateForm()"
        >
          + Thêm mã
        </button>
      </div>
    </div>

    <main class="relative flex min-h-0 flex-1">
      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <div
          v-if="store.loadError"
          class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{{ store.loadError }}</span
          ><button type="button" class="font-bold underline" @click="store.loadCodes()">Thử lại</button>
        </div>
        <div v-if="store.isLoading" class="grid min-h-64 place-items-center text-sm text-gray-500">
          Đang tải danh sách mã...
        </div>
        <div
          v-else-if="!store.filteredCodes.length"
          class="grid min-h-64 place-items-center text-center text-sm text-gray-500"
        >
          <div>
            <span class="mb-2 block text-3xl">🎟️</span
            >{{ store.codes.length ? "Không tìm thấy mã phù hợp." : "Chưa có mã đổi thưởng nào." }}
          </div>
        </div>
        <div v-else class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table class="w-full min-w-220 border-separate border-spacing-0 text-left text-sm">
            <thead class="text-[11px] uppercase text-gray-600">
              <tr>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Mã</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Phần thưởng</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Trạng thái</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Hạn dùng</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Ngày tạo</th>
                <th class="sticky top-0 z-10 bg-gray-100 px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in store.filteredCodes" :key="item.id" class="border-t border-gray-100 hover:bg-emerald-50/40">
                <td class="px-4 py-3">
                  <span class="rounded bg-gray-100 px-2 py-1 font-mono font-bold text-gray-800">{{ item.code }}</span>
                </td>
                <td class="whitespace-nowrap px-4 py-3 font-semibold text-emerald-800">
                  {{ item.cash.toLocaleString("vi-VN") }} xu
                </td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                    :class="
                      item.isDisabled
                        ? 'border-gray-200 bg-gray-100 text-gray-600'
                        : isExpired(item)
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    "
                    >{{ item.isDisabled ? "Đang tắt" : isExpired(item) ? "Đã hết hạn" : "Đang bật" }}</span
                  >
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{{ formatDate(item.expiresAt) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                  {{ new Date(item.createdAt).toLocaleString("vi-VN") }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                      :disabled="store.updatingId === item.id"
                      @click="store.toggleEnabled(item)"
                    >
                      {{ store.updatingId === item.id ? "..." : item.isDisabled ? "Bật" : "Tắt" }}</button
                    ><button
                      type="button"
                      class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
                      @click="store.openEditForm(item)"
                    >
                      Sửa</button
                    ><button
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
    </main>

    <RedeemCodeFormModal />
    <RedeemCodeDeleteModal />
  </div>
</template>
