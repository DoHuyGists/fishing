<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import AdminModal from "../AdminModal.vue";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";
import RichTextContent from "../../shared/RichTextContent.vue";
import RichEditor from "../../shared/RichEditor.vue";
import { useAdminGuidesStore } from "./admin-guides-store";

const emit = defineEmits<{ close: [] }>();
const store = useAdminGuidesStore();
const preview = ref(false);
const formatDate = (value: string) => new Date(value).toLocaleString("vi-VN");

function close() {
  if (!store.busy) emit("close");
}
function openCreate() { preview.value = false; store.openCreate(); }
function openEdit(row: Parameters<typeof store.openEdit>[0]) { preview.value = false; store.openEdit(row); }

onMounted(() => { store.resetView(); void store.fetchRows(); });
onUnmounted(() => store.resetView());
</script>

<template>
  <AdminModal title="Quản lý hướng dẫn" icon="📖" :close-disabled="store.busy" @close="close">
    <template #subtitle>{{ store.rows.length }} hướng dẫn · Nội dung hiển thị cho người chơi</template>
    <form v-if="store.isFormOpen" class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" @submit.prevent="store.save()">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-lg font-bold">{{ store.editingId ? 'Sửa hướng dẫn' : 'Tạo hướng dẫn' }}</div>
        <button type="button" :disabled="store.saving" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm disabled:opacity-50" @click="store.closeForm()">Quay lại danh sách</button>
      </div>
      <div v-if="store.formError" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ store.formError }}</div>
      <fieldset :disabled="store.saving" class="space-y-4 disabled:opacity-60">
        <legend class="sr-only">Thông tin hướng dẫn</legend>
        <label class="block text-sm font-semibold">Tiêu đề <span aria-hidden="true">*</span>
          <input v-model="store.form.title" type="text" required class="mt-1 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 font-normal focus:outline-emerald-700" placeholder="Nhập tiêu đề hướng dẫn" />
        </label>
        <div class="flex flex-wrap items-end gap-4">
          <label class="block text-sm font-semibold">Thứ tự hiển thị
            <input v-model.number="store.form.sort_order" type="number" step="1" min="-2147483648" max="2147483647" required class="mt-1 block w-48 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 font-normal focus:outline-emerald-700" />
          </label>
          <label class="flex min-h-10 items-center gap-2 text-sm font-semibold"><input v-model="store.form.is_published" type="checkbox" class="size-4 accent-emerald-800" />Xuất bản cho người chơi</label>
        </div>
        <div class="text-xs text-[#24352a]/70">Số thứ tự nhỏ hơn được hiển thị trước. Bỏ chọn xuất bản để ẩn hướng dẫn.</div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm font-semibold">Nội dung <span aria-hidden="true">*</span></div>
          <button type="button" :aria-pressed="preview" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-1.5 text-xs font-semibold" @click="preview = !preview">{{ preview ? 'Tiếp tục soạn thảo' : 'Xem trước' }}</button>
        </div>
        <div v-if="preview" class="min-h-72 rounded-xl border border-[#cbd9c6] bg-white p-4">
          <div class="mb-4 break-words text-xl font-bold">{{ store.form.title || 'Tiêu đề hướng dẫn' }}</div>
          <RichTextContent :content="store.form.content" />
        </div>
        <RichEditor v-show="!preview" v-model="store.form.content" :disabled="store.saving" :invalid="!!store.formError" />
      </fieldset>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" :disabled="store.saving" class="rounded-lg border border-[#cbd9c6] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50" @click="store.closeForm()">Hủy</button>
        <button type="submit" :disabled="store.saving || store.loading" class="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">{{ store.saving ? 'Đang lưu…' : 'Lưu hướng dẫn' }}</button>
      </div>
    </form>
    <template v-else>
      <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#cbd9c6] p-4 sm:px-6">
        <input v-model="store.search" type="search" aria-label="Tìm hướng dẫn" placeholder="Tìm tiêu đề hoặc nội dung…" class="min-w-48 flex-1 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm focus:outline-emerald-700" />
        <select v-model="store.status" aria-label="Lọc trạng thái xuất bản" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"><option value="all">Tất cả trạng thái</option><option value="published">Đã xuất bản</option><option value="hidden">Đang ẩn</option></select>
        <button type="button" :disabled="store.loading || store.busy" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50" @click="store.fetchRows()">{{ store.loading ? 'Đang tải…' : 'Làm mới' }}</button>
        <button type="button" :disabled="store.loading || store.busy" class="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50" @click="openCreate">+ Tạo hướng dẫn</button>
      </div>
      <div v-if="store.error" role="alert" class="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-6">{{ store.error }}</div>
      <div class="min-h-0 flex-1 overflow-auto p-4 sm:p-6" :aria-busy="store.loading">
        <div v-if="store.loading && !store.rows.length" role="status" class="py-12 text-center text-sm">Đang tải hướng dẫn…</div>
        <div v-else-if="!store.filteredRows.length" class="rounded-xl border border-dashed border-[#cbd9c6] bg-white p-10 text-center text-sm text-[#24352a]/70">{{ store.rows.length ? 'Không có hướng dẫn phù hợp với bộ lọc.' : 'Chưa có hướng dẫn nào.' }}</div>
        <div v-else class="overflow-x-auto rounded-xl border border-[#cbd9c6] bg-white">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="bg-[#eaf1e5] text-xs uppercase"><tr><th scope="col" class="px-4 py-3">Thứ tự</th><th scope="col" class="px-4 py-3">Hướng dẫn</th><th scope="col" class="px-4 py-3">Trạng thái</th><th scope="col" class="px-4 py-3">Ngày tạo</th><th scope="col" class="px-4 py-3 text-right">Thao tác</th></tr></thead>
            <tbody>
              <tr v-for="row in store.filteredRows" :key="row.id" class="border-t border-[#cbd9c6] align-top hover:bg-[#f5f9f0]">
                <td class="px-4 py-3 tabular-nums">{{ row.sort_order }}</td>
                <td class="max-w-md px-4 py-3"><div class="break-words font-bold">{{ row.title }}</div><div class="mt-1 line-clamp-2 break-words text-xs text-[#24352a]/65">{{ row.excerpt }}</div></td>
                <td class="whitespace-nowrap px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="row.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'">{{ row.is_published ? 'Đã xuất bản' : 'Đang ẩn' }}</span></td>
                <td class="whitespace-nowrap px-4 py-3 text-xs">{{ formatDate(row.created_at) }}</td>
                <td class="px-4 py-3"><div class="flex justify-end gap-2">
                  <button type="button" :disabled="store.loading || store.busy" class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50" :aria-label="`Sửa hướng dẫn ${row.title}`" @click="openEdit(row)">Sửa</button>
                  <button type="button" :disabled="store.loading || store.busy" class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50" :aria-label="`Xóa hướng dẫn ${row.title}`" @click="store.requestDelete(row)">Xóa</button>
                </div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
    <TwoOptionsModal v-if="store.deleting" title="Xóa hướng dẫn?" first-text="Hủy" :second-text="store.removing ? 'Đang xóa…' : 'Xóa hướng dẫn'" :first-disabled="store.removing" :second-disabled="store.removing" :on-first="store.cancelDelete" :on-second="store.remove" :on-dismiss="store.cancelDelete">
      <div class="break-words text-sm">Bạn có chắc muốn xóa “{{ store.deleting.title }}”? Thao tác này không thể hoàn tác.</div>
      <div v-if="store.deleteError" role="alert" class="mt-3 text-sm text-red-700">{{ store.deleteError }}</div>
    </TwoOptionsModal>
  </AdminModal>
</template>
