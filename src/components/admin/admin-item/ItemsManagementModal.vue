<script lang="ts" setup>
import AdminModal from "../AdminModal.vue";
import Pagination from "../../shared/Pagination.vue";
import { usePagedListFilters } from "../../../composables/usePagedListFilters.ts";
import { onMounted } from "vue";
import { storeToRefs } from "pinia";

import { useAdminItemsManagementStore } from "./admin-items-management-store.ts";
import ItemForm from "./ItemsFormModal.vue";

const emit = defineEmits(["close"]);
const store = useAdminItemsManagementStore();
usePagedListFilters(
  [() => store.search, () => store.categoryFilter, () => store.statusFilter],
  () => {
    void store.loadItems(1);
  },
  () => {
    ++store.requestId;
  },
);
const {
  items,
  search,
  categoryFilter,
  statusFilter,
  isLoading,
  loadError,
  isFormOpen,
  isSaving,
  formError,
  deletingId,
  updatingId,
  confirmDeleteId,
  editingItem,
  categories,
  filteredItems,
} = storeToRefs(store);
const { loadItems, openCreateForm, openEditForm, closeForm, saveItem, toggleEnabled, deleteItem } = store;

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

onMounted(loadItems);
</script>

<template>
  <AdminModal title="Quản lý vật phẩm" icon="🎒" @close="emit('close')">
    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-white px-5 py-3 md:px-7">
      <div class="min-w-55 flex-1">
        <input
          v-model="search"
          type="search"
          placeholder="Tìm tên, mô tả, biểu tượng, đường dẫn..."
          class="w-full rounded-lg border border-content bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>
      <label class="flex items-center gap-2 text-xs font-semibold text-content">
        Danh mục
        <select
          v-model="categoryFilter"
          class="max-w-44 rounded-lg border border-content bg-white px-2.5 py-2 text-sm text-content"
        >
          <option value="ALL">Tất cả</option>
          <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-xs font-semibold text-content">
        Hiển thị
        <select
          v-model="statusFilter"
          class="rounded-lg border border-content bg-white px-2.5 py-2 text-sm text-content"
        >
          <option value="ALL">Tất cả</option>
          <option value="ENABLED">Đang bật</option>
          <option value="DISABLED">Đang tắt</option>
        </select>
      </label>
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden text-xs text-content sm:inline">{{ filteredItems.length }} kết quả</span>
        <button
          type="button"
          title="Làm mới danh sách"
          class="grid size-9 place-items-center rounded-lg border border-content bg-white text-content hover:bg-surface disabled:opacity-50"
          :disabled="isLoading"
          @click="loadItems()"
        >
          <svg
            class="size-4"
            :class="{ 'animate-spin': isLoading }"
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
          @click="openCreateForm"
        >
          + Thêm vật phẩm
        </button>
      </div>
    </div>

    <main class="relative flex min-h-0 flex-1">
      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <div
          v-if="loadError"
          class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-danger bg-surface px-4 py-3 text-sm text-danger"
        >
          <span>{{ loadError }}</span>
          <button type="button" class="font-bold underline" @click="loadItems()">Thử lại</button>
        </div>
        <div v-if="isLoading" class="grid min-h-64 place-items-center text-sm text-content">
          Đang tải danh sách vật phẩm...
        </div>
        <div
          v-else-if="!filteredItems.length"
          class="grid min-h-64 place-items-center text-center text-sm text-content"
        >
          <div>
            <span class="mb-2 block text-3xl">🎒</span
            >{{ items.length ? "Không tìm thấy vật phẩm phù hợp." : "Chưa có vật phẩm nào." }}
          </div>
        </div>
        <div v-else class="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-white shadow-sm">
          <table class="w-full min-w-280 border-separate border-spacing-0 text-left text-sm">
            <thead class="text-[11px] uppercase text-content">
              <tr>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Vật phẩm</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Danh mục / phân loại</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Giá / tồn kho</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Biểu tượng</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Hiển thị</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Ngày tạo</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3">Cập nhật</th>
                <th class="sticky top-0 z-10 bg-surface px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredItems" :key="item.id" class="border-t border-border hover:bg-surface/40">
                <td class="max-w-120 px-4 py-3">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="item.image"
                      :src="item.image"
                      :alt="item.name"
                      class="size-12 shrink-0 rounded-md border border-border bg-white object-cover"
                      loading="lazy"
                    />
                    <div
                      v-else
                      class="grid size-12 shrink-0 place-items-center rounded-md border border-border bg-white text-xl"
                    >
                      {{ item.icon || "🎒" }}
                    </div>
                    <div class="min-w-0">
                      <div class="truncate font-bold text-content" :title="item.name">{{ item.name }}</div>
                      <div class="mt-1 max-w-104 truncate text-xs text-content" :title="item.information">
                        {{ item.information }}
                      </div>
                      <div
                        v-if="item.image"
                        class="mt-1 max-w-104 truncate text-[10px] text-content"
                        :title="item.image"
                      >
                        {{ item.image }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-content">
                  <div>{{ item.category || "—" }}</div>
                  <div class="mt-1 text-xs text-content">{{ item.classification || "—" }}</div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-content">
                  <div class="font-semibold">{{ item.price.toLocaleString("vi-VN") }} đ</div>
                  <div class="mt-1 text-xs text-content">
                    {{ item.quantity == null ? "Không giới hạn" : `Tồn ${item.quantity.toLocaleString("vi-VN")}` }}
                  </div>
                </td>
                <td class="px-4 py-3 text-2xl">{{ item.icon || "—" }}</td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                    :class="
                      item.isDisabled === false
                        ? 'border-accent bg-surface text-content'
                        : 'border-border bg-surface text-content'
                    "
                    >{{ item.isDisabled === false ? "Đang bật" : "Đang tắt" }}</span
                  >
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-content">{{ formatDate(item.createdAt) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-xs text-content">{{ formatDate(item.updatedAt) }}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-md border border-accent px-2.5 py-1.5 text-xs font-bold text-content hover:bg-surface disabled:opacity-50"
                      :disabled="updatingId === item.id"
                      @click="toggleEnabled(item)"
                    >
                      {{ updatingId === item.id ? "..." : item.isDisabled === false ? "Tắt" : "Bật" }}
                    </button>
                    <button
                      type="button"
                      class="rounded-md border border-content px-2.5 py-1.5 text-xs font-bold text-content hover:bg-surface"
                      @click="openEditForm(item)"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      class="rounded-md border border-danger px-2.5 py-1.5 text-xs font-bold text-danger hover:bg-surface"
                      @click="confirmDeleteId = item.id"
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

      <ItemForm
        v-if="isFormOpen"
        :item="editingItem"
        :categories="categories"
        :saving="isSaving"
        :error="formError"
        @close="closeForm"
        @save="saveItem"
      />
    </main>

    <div v-if="confirmDeleteId" class="fixed inset-0 z-40 grid place-items-center bg-content/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div class="m-0 text-base font-extrabold text-content">Xác nhận xoá vật phẩm?</div>
        <div class="my-3 text-sm text-content">
          Thao tác này không thể hoàn tác. Các dữ liệu liên quan có thể bị ràng buộc bởi cơ sở dữ liệu.
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-content px-3 py-2 text-sm font-bold text-content"
            @click="confirmDeleteId = null"
          >
            Huỷ
          </button>
          <button
            type="button"
            :disabled="deletingId === confirmDeleteId"
            class="rounded-lg bg-danger px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            @click="deleteItem"
          >
            {{ deletingId ? "Đang xoá..." : "Xoá vật phẩm" }}
          </button>
        </div>
      </div>
    </div>
    <Pagination
      :page="store.page"
      :page-size="store.pageSize"
      :total="store.total"
      :loading="store.isLoading"
      @change="store.loadItems($event)"
    />
  </AdminModal>
</template>
