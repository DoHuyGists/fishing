<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import AdminModal from "../AdminModal.vue";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";
import SkillFormManagement from "./SkillFormManagement.vue";
import { useAdminSkillStore } from "./admin-skill-store";

const emit = defineEmits<{ close: [] }>();
const store = useAdminSkillStore();
onMounted(() => { store.search = ""; void store.fetchAll(); });
onUnmounted(() => { store.closeForm(); store.cancelDelete(); });
</script>

<template>
  <AdminModal title="Quản lý kỹ năng" subtitle="Cấu hình kỹ năng, giới hạn cấp và hiệu ứng mỗi cấp." icon="✨" :close-disabled="store.busy" @close="emit('close')">
    <div class="flex shrink-0 flex-wrap gap-3 border-b border-[#cbd9c6] bg-white p-4">
      <input v-model="store.search" type="search" aria-label="Tìm kỹ năng" placeholder="Tìm theo mã, tên hoặc mô tả..." class="min-w-0 flex-1 rounded-lg border border-[#cbd9c6] px-3 py-2 text-sm" />
      <button type="button" :disabled="store.busy" class="rounded-lg border border-[#cbd9c6] px-3 py-2 text-sm disabled:opacity-50" @click="store.fetchAll">{{ store.loading ? 'Đang tải...' : 'Làm mới' }}</button>
      <button type="button" :disabled="store.busy" class="rounded-lg bg-[#24352a] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" @click="store.openForm()">+ Thêm kỹ năng</button>
    </div>
    <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
      <div v-if="store.error && !store.deleteTarget" role="alert" class="shrink-0 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ store.error }}</div>
      <div v-if="store.loading && !store.items.length" role="status" class="py-10 text-center text-sm">Đang tải danh sách kỹ năng...</div>
      <div v-else-if="!store.filteredItems.length && !store.error" class="py-10 text-center text-sm">{{ store.search ? 'Không tìm thấy kỹ năng phù hợp.' : 'Chưa có kỹ năng nào.' }}</div>
      <div v-else-if="store.filteredItems.length" class="min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border border-[#cbd9c6] bg-white">
        <table class="w-full min-w-[800px] text-left text-sm">
          <thead class="sticky top-0 z-10 bg-[#f5f9f0]"><tr>
            <th class="p-3">Thứ tự</th><th class="p-3">Mã</th><th class="p-3">Kỹ năng</th><th class="p-3">Cấp tối đa</th><th class="p-3">Trạng thái</th><th class="p-3 text-right">Thao tác</th>
          </tr></thead>
          <tbody>
            <tr v-for="item in store.filteredItems" :key="item.id" class="border-t border-[#cbd9c6]">
              <td class="p-3">{{ item.sort_order }}</td>
              <td class="p-3 font-mono">{{ item.code }}</td>
              <td class="max-w-sm p-3"><div class="m-0 font-bold">{{ item.name }}</div><div v-if="item.description" class="mb-0 mt-1 whitespace-pre-line text-xs text-gray-500">{{ item.description }}</div></td>
              <td class="p-3">{{ item.max_level }}</td>
              <td class="p-3">{{ item.is_disabled ? 'Vô hiệu hóa' : 'Hoạt động' }}</td>
              <td class="p-3"><div class="flex justify-end gap-2">
                <button type="button" :disabled="store.busy" class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 disabled:opacity-50" @click="store.openForm(item)">Sửa</button>
                <button type="button" :disabled="store.busy" class="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 disabled:opacity-50" @click="store.requestDelete(item)">Xóa</button>
              </div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
    <SkillFormManagement />
    <TwoOptionsModal v-if="store.deleteTarget" title="Xóa kỹ năng" :message="`Xóa kỹ năng “${store.deleteTarget.name}”?`" sub-text="Thao tác này cũng xóa cấp kỹ năng đã học của mọi người chơi và không thể hoàn tác." first-text="Hủy" :second-text="store.deleting ? 'Đang xóa...' : 'Xóa kỹ năng'" :first-disabled="store.deleting" :second-disabled="store.deleting" :on-first="store.cancelDelete" :on-second="store.remove" :on-dismiss="store.cancelDelete">
      <div class="text-sm">Xóa kỹ năng “{{ store.deleteTarget.name }}”?</div>
      <div v-if="store.error" role="alert" class="text-sm text-red-700">{{ store.error }}</div>
    </TwoOptionsModal>
  </AdminModal>
</template>
