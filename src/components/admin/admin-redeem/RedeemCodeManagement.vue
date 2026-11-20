<script lang="ts" setup>
import type { RedeemCodeRow } from "../../../types/table/redeemCode.ts";
import AdminModal from "../AdminModal.vue";
import Pagination from "../../shared/Pagination.vue";
import { usePagedListFilters } from "../../../composables/usePagedListFilters.ts";
import { onMounted } from "vue";

import RedeemCodeDeleteModal from "./RedeemCodeDeleteModal.vue";
import RedeemCodeFormModal from "./RedeemCodeFormModal.vue";
import { isRedeemCodeExpired, useAdminRedeemCodeStore } from "./admin-redeem-code-store.ts";

const emit = defineEmits(["close"]);
const store = useAdminRedeemCodeStore();
usePagedListFilters(
  [() => store.search, () => store.statusFilter],
  () => {
    void store.loadCodes(1);
  },
  () => {
    ++store.requestId;
  },
);

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "Không hết hạn";
}

const isExpired = (item: RedeemCodeRow) => isRedeemCodeExpired(item);

onMounted(() => store.loadCodes());
</script>

<template>
  <AdminModal title="Quản lý mã đổi thưởng" icon="🎟️" @close="emit('close')">
    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-white px-5 py-3 md:px-7">
      <div class="min-w-55 flex-1">
        <input
          v-model="store.search"
          type="search"
          placeholder="Tìm mã đổi thưởng..."
          class="w-full rounded-lg border border-content bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>
      <label class="flex items-center gap-2 text-xs font-semibold text-content"
        >Trạng thái
        <select
          v-model="store.statusFilter"
          class="rounded-lg border border-content bg-white px-2.5 py-2 text-sm text-content"
        >
          <option value="ALL">Tất cả</option>
          <option value="ACTIVE">Đang bật</option>
          <option value="DISABLED">Đang tắt</option>
          <option value="EXPIRED">Đã hết hạn</option>
        </select>
      </label>
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden text-xs text-content sm:inline">{{ store.filteredCodes.length }} kết quả</span>
        <button
          type="button"
          title="Làm mới danh sách"
          class="grid size-9 place-items-center rounded-lg border border-content bg-white text-content hover:bg-surface disabled:opacity-50"
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
          class="rounded-lg bg-content-strong px-3.5 py-2 text-sm font-bold text-white hover:bg-accent"
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
          class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-danger bg-surface px-4 py-3 text-sm text-danger"
        >
          <span>{{ store.loadError }}</span
          ><button type="button" class="font-bold underline" @click="store.loadCodes()">Thử lại</button>
        </div>
        <div v-if="store.isLoading" class="grid min-h-64 place-items-center text-sm text-content">
          Đang tải danh sách mã...
        </div>
        <div
          v-else-if="!store.filteredCodes.length"
          class="grid min-h-64 place-items-center text-center text-sm text-content"
        >
          <div>
            <span class="mb-2 block text-3xl">🎟️</span
            >{{ store.codes.length ? "Không tìm thấy mã phù hợp." : "Chưa có mã đổi thưởng nào." }}
          </div>
        </div>
        <div v-else class="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-white shadow-sm">
          <table class="w-full min-w-220 border-separate border-spacing-0 text-left text-sm">
            <thead class="text-[11px] uppercase text-content">
              <tr>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Mã</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Phần thưởng</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Trạng thái</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Hạn dùng</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Ngày tạo</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in store.filteredCodes"
                :key="item.id"
                class="border-t border-border hover:bg-surface/40"
              >
                <td class="px-4 py-3">
                  <span class="rounded bg-surface px-2 py-1 font-mono font-bold text-content">{{ item.code }}</span>
                </td>
                <td class="whitespace-nowrap px-4 py-3 font-semibold text-content">
                  {{ item.cash.toLocaleString("vi-VN") }} xu
                </td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                    :class="
                      item.isDisabled
                        ? 'border-border bg-surface text-content'
                        : isExpired(item)
                          ? 'border-gold bg-surface text-gold'
                          : 'border-accent bg-surface text-content'
                    "
                    >{{ item.isDisabled ? "Đang tắt" : isExpired(item) ? "Đã hết hạn" : "Đang bật" }}</span
                  >
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-content">{{ formatDate(item.expiresAt) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-content">
                  {{ new Date(item.createdAt).toLocaleString("vi-VN") }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-md border border-accent px-2.5 py-1.5 text-xs font-bold text-content hover:bg-surface disabled:opacity-50"
                      :disabled="store.updatingId === item.id"
                      @click="store.toggleEnabled(item)"
                    >
                      {{ store.updatingId === item.id ? "..." : item.isDisabled ? "Bật" : "Tắt" }}</button
                    ><button
                      type="button"
                      class="rounded-md border border-content px-2.5 py-1.5 text-xs font-bold text-content hover:bg-surface"
                      @click="store.openEditForm(item)"
                    >
                      Sửa</button
                    ><button
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

    <RedeemCodeFormModal />
    <RedeemCodeDeleteModal />
    <Pagination
      :page="store.page"
      :page-size="store.pageSize"
      :total="store.total"
      :loading="store.isLoading"
      @change="store.loadCodes($event)"
    />
  </AdminModal>
</template>
