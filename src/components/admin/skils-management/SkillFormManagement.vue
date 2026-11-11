<script setup lang="ts">
import AdminModal from "../AdminModal.vue";
import { useAdminSkillStore } from "./admin-skill-store";

const store = useAdminSkillStore();
</script>

<template>
  <AdminModal v-if="store.formOpen && store.draft" :title="store.editingId ? 'Chỉnh sửa kỹ năng' : 'Thêm kỹ năng'" :z-index="60" :close-disabled="store.saving" @close="store.closeForm">
    <form class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" @submit.prevent="store.save">
      <fieldset :disabled="store.saving" class="mx-auto grid max-w-3xl gap-4 rounded-xl border border-[#cbd9c6] bg-white p-4 sm:grid-cols-2">
        <legend class="px-2 text-sm font-bold">Thông tin kỹ năng</legend>
        <label class="flex flex-col gap-1 text-sm font-semibold">Mã kỹ năng
          <input v-model="store.draft.code" required class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal" />
        </label>
        <label class="flex flex-col gap-1 text-sm font-semibold">Tên kỹ năng
          <input v-model="store.draft.name" required class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal" />
        </label>
        <label class="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">Mô tả
          <textarea v-model="store.draft.description" rows="3" class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal"></textarea>
        </label>
        <label class="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">Biểu tượng (emoji hoặc URL ảnh)
          <input v-model="store.draft.icon" class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal" />
        </label>
        <label class="flex flex-col gap-1 text-sm font-semibold">Cấp tối đa
          <input v-model.number="store.draft.max_level" type="number" min="1" max="2147483647" step="1" required class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal" />
        </label>
        <label class="flex flex-col gap-1 text-sm font-semibold">Thứ tự hiển thị
          <input v-model.number="store.draft.sort_order" type="number" min="-2147483648" max="2147483647" step="1" required class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-normal" />
        </label>
        <label class="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">Hiệu ứng mỗi cấp (JSON)
          <textarea v-model="store.draft.effectsJson" rows="8" required spellcheck="false" class="rounded-lg border border-[#cbd9c6] px-3 py-2 font-mono font-normal"></textarea>
          <span class="text-xs font-normal text-gray-500">Nhập đối tượng JSON theo cấu hình hiệu ứng của trò chơi. Dùng {} nếu không có hiệu ứng.</span>
        </label>
        <label class="flex items-center gap-2 text-sm sm:col-span-2">
          <input v-model="store.draft.is_disabled" type="checkbox" /> Vô hiệu hóa kỹ năng
        </label>
        <div v-if="store.formError" role="alert" class="m-0 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{{ store.formError }}</div>
        <div class="flex justify-end gap-2 sm:col-span-2">
          <button type="button" class="rounded-lg border border-[#cbd9c6] px-4 py-2 text-sm" @click="store.closeForm">Hủy</button>
          <button type="submit" class="rounded-lg bg-[#24352a] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{{ store.saving ? 'Đang lưu...' : 'Lưu kỹ năng' }}</button>
        </div>
      </fieldset>
    </form>
  </AdminModal>
</template>
