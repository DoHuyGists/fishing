<script setup lang="ts">
import AdminModal from "../AdminModal.vue";
import Pagination from '../../shared/Pagination.vue';
import { usePagedListFilters } from '../../../composables/usePagedListFilters';
import { computed, onMounted, ref } from "vue";
import { useDepthScopeStore } from "./admin-depth-scope-store.ts";
import DepthScopeForm from "./DepthScopeForm.vue";

const emit = defineEmits<{ close: [] }>();
const store = useDepthScopeStore();
const search = computed({ get: () => store.search, set: value => { store.search = value; } });
usePagedListFilters([search], () => { void store.fetchAll(1); }, () => { ++store.requestId; });
const deleteTarget = ref<{ id: string; name: string } | null>(null);
const deleting = ref(false);
const actionError = ref("");
const filteredItems = computed(() => {
  return store.itemsWithCurves;
});

async function remove() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  actionError.value = "";
  try {
    await store.remove(deleteTarget.value.id);
    deleteTarget.value = null;
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : "Không thể xóa phạm vi độ sâu.";
  } finally {
    deleting.value = false;
  }
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

onMounted(() => store.fetchAll());
</script>

<template>
  <AdminModal
    title="Quản lý phạm vi độ sâu"
    subtitle="Tạo và cấu hình các khoảng độ sâu dùng trong trò chơi."
    @close="emit('close')"
  >

    <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#cbd9c6] bg-white px-5 py-3 sm:px-8">
      <input
        v-model="search"
        type="search"
        placeholder="Tìm theo mã hoặc tên…"
        class="min-w-56 flex-1 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#cbd9c6]"
      />
      <button
        type="button"
        :disabled="store.loading"
        class="rounded-lg border border-[#cbd9c6] px-3 py-2 text-sm hover:bg-[#f5f9f0] disabled:opacity-50"
        @click="store.fetchAll()"
      >
        {{ store.loading ? "Đang tải…" : "Làm mới" }}
      </button>
      <button
        type="button"
        class="rounded-lg bg-[#24352a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#314a39]"
        @click="store.openCreate()"
      >
        + Thêm phạm vi
      </button>
    </div>

    <main class="min-h-0 flex-1 overflow-auto p-4 sm:p-8">
      <div v-if="store.error" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ store.error }}
      </div>
      <div v-if="actionError" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ actionError }}
      </div>
      <div v-if="store.loading && !store.items.length" class="py-16 text-center text-sm text-gray-500">
        Đang tải danh sách…
      </div>
      <div
        v-else-if="!filteredItems.length"
        class="rounded-xl border border-dashed border-[#cbd9c6] bg-white py-16 text-center text-sm text-gray-500"
      >
        {{ search ? "Không tìm thấy phạm vi phù hợp." : "Chưa có phạm vi độ sâu nào." }}
      </div>
      <div v-else class="overflow-x-auto rounded-xl border border-[#cbd9c6] bg-white shadow-sm">
        <table class="w-full min-w-[1070px] border-collapse text-left text-sm">
          <thead class="bg-[#f5f9f0] text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th class="px-4 py-3">Mã</th>
              <th class="px-4 py-3">Tên</th>
              <th class="px-4 py-3">Min</th>
              <th class="px-4 py-3">Đỉnh</th>
              <th class="px-4 py-3">Max</th>
              <th class="px-4 py-3">Độ cong</th>
              <th class="px-4 py-3">Đường cong</th>
              <th class="px-4 py-3">Cập nhật</th>
              <th class="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredItems" :key="item.id" class="border-t border-[#e5ece2] hover:bg-[#f5f9f0]/70">
              <td class="px-4 py-3 font-mono font-semibold">{{ item.code }}</td>
              <td class="px-4 py-3 font-medium">{{ item.name }}</td>
              <td class="px-4 py-3">{{ item.minDepth.toFixed(2) }}</td>
              <td class="px-4 py-3">{{ item.peakDepth.toFixed(2) }}</td>
              <td class="px-4 py-3">{{ item.maxDepth.toFixed(2) }}</td>
              <td class="px-4 py-3">{{ item.curvePower.toFixed(2) }}</td>
              <td class="px-4 py-3">
                <svg
                  v-if="item.curve"
                  viewBox="0 0 208 94"
                  role="img"
                  :aria-label="`Đường cong ${item.name}: từ ${item.minDepth} đến ${item.maxDepth} mét, đỉnh ${item.peakDepth} mét, độ cong ${item.curvePower}`"
                  class="h-[94px] w-52 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a]"
                >
                  <title>Hệ số phù hợp theo độ sâu (0–1), đỉnh {{ item.peakDepth.toFixed(2) }}m.</title>
                  <path d="M24 10H184 M24 38H184" fill="none" stroke="#cbd9c6" stroke-dasharray="3 3" />
                  <path d="M24 10V66H184" fill="none" stroke="#cbd9c6" />
                  <line :x1="item.curve.peakX" y1="10" :x2="item.curve.peakX" y2="66" stroke="#cbd9c6" stroke-dasharray="3 3" />
                  <polyline :points="item.curve.points" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                  <circle :cx="item.curve.peakX" cy="10" r="3" fill="currentColor" />
                  <g fill="currentColor" font-size="9">
                    <text x="17" y="13" text-anchor="end">1</text>
                    <text x="17" y="69" text-anchor="end">0</text>
                    <text x="24" y="80" text-anchor="middle">{{ item.minDepth.toFixed(2) }}</text>
                    <text x="184" y="80" text-anchor="middle">{{ item.maxDepth.toFixed(2) }}</text>
                    <text x="104" y="90" text-anchor="middle">Độ sâu (m)</text>
                  </g>
                </svg>
                <span v-else class="text-xs text-gray-500">Thông số không hợp lệ</span>
              </td>
              <td class="px-4 py-3 text-gray-500">{{ formatDate(item.updatedAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs font-semibold hover:bg-[#f5f9f0]"
                    @click="store.openEdit(item)"
                  >
                    Sửa</button
                  ><button
                    type="button"
                    class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    @click="deleteTarget = { id: item.id, name: item.name }"
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

    <DepthScopeForm />
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4"
      @click.self="deleteTarget = null"
    >
      <div class="w-full max-w-sm rounded-2xl border border-[#cbd9c6] bg-white p-5 shadow-xl">
        <div class="m-0 text-lg font-bold">Xác nhận xóa</div>
        <div class="my-3 text-sm text-gray-600">
          Xóa phạm vi “{{ deleteTarget.name }}”? Thao tác này không thể hoàn tác.
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-[#cbd9c6] px-4 py-2 text-sm"
            @click="deleteTarget = null"
          >
            Hủy</button
          ><button
            type="button"
            :disabled="deleting"
            class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            @click="remove"
          >
            {{ deleting ? "Đang xóa…" : "Xóa" }}
          </button>
        </div>
      </div>
    </div>
    <Pagination :page="store.page" :page-size="store.pageSize" :total="store.total" :loading="store.loading" @change="store.fetchAll($event)" />
  </AdminModal>
</template>
