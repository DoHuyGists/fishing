<script setup lang="ts">
import { onMounted, ref } from "vue";
import AdminModal from "../AdminModal.vue";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";
import { ASSET_MIME_TYPES } from "../../../data/supabaseAssetRepository";
import { useAdminAssetsStore } from "./admin-assets-store";

const emit = defineEmits<{ close: [] }>();
const store = useAdminAssetsStore();
const fileInput = ref<HTMLInputElement | null>(null);
const accept = Object.keys(ASSET_MIME_TYPES).join(",");
const formatSize = (size: number) => size < 1024 * 1024
  ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
const formatDate = (date: string) => date ? new Date(date).toLocaleString("vi-VN") : "—";
function selectFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = "";
  void store.upload(files);
}
function close() { if (!store.busy) emit("close"); }
onMounted(() => { store.resetView(); void store.fetchRows(); });
</script>

<template>
  <AdminModal title="Quản lý ảnh & video" subtitle="Lưu trữ và sao chép link để sử dụng trong nội dung" :close-disabled="store.busy" @close="close">
    <div class="shrink-0 space-y-3 border-b border-[#cbd9c6] p-4 sm:px-6">
      <div class="flex flex-wrap gap-3">
        <input v-model="store.search" type="search" aria-label="Tìm tên tệp" placeholder="Tìm tên tệp…" class="min-w-48 flex-1 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm focus:outline-emerald-700" />
        <select v-model="store.kind" aria-label="Lọc loại tệp" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm">
          <option value="all">Tất cả</option><option value="image">Ảnh</option><option value="video">Video</option>
        </select>
        <button type="button" :disabled="store.loading || store.busy" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50" @click="store.fetchRows()">{{ store.loading ? 'Đang tải…' : 'Làm mới' }}</button>
        <input ref="fileInput" type="file" multiple :accept="accept" :disabled="store.loading || store.busy" aria-label="Chọn ảnh hoặc video tải lên" class="sr-only" tabindex="-1" @change="selectFiles" />
        <button type="button" :disabled="store.loading || store.busy" class="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50" @click="fileInput?.click()">{{ store.uploading ? 'Đang tải lên…' : '+ Tải ảnh / video' }}</button>
      </div>
      <div class="text-xs text-[#24352a]/70">JPG, PNG, GIF, WebP, AVIF, MP4, WebM, MOV · Tối đa 50 MB/tệp · Link công khai, không hết hạn.</div>
      <div v-if="store.uploading" role="status" aria-live="polite" class="text-sm font-semibold">Đã xử lý {{ store.completed }}/{{ store.total }} tệp. Vui lòng giữ cửa sổ mở.</div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" :aria-busy="store.loading">
      <div v-if="store.error" role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ store.error }}</div>
      <div v-if="store.uploadErrors.length" role="alert" class="mb-4 max-h-48 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <div class="font-semibold">Các tệp chưa tải lên được:</div>
        <ul class="mt-2 list-inside list-disc break-words"><li v-for="(error, index) in store.uploadErrors" :key="index">{{ error }}</li></ul>
      </div>
      <div class="mb-4 text-sm">{{ store.filteredRows.length }} / {{ store.rows.length }} tệp</div>
      <div v-if="store.loading && !store.rows.length" role="status" class="py-12 text-center text-sm">Đang tải ảnh và video…</div>
      <div v-else-if="!store.filteredRows.length && !store.error" class="rounded-xl border border-dashed border-[#cbd9c6] bg-white p-10 text-center text-sm">{{ store.rows.length ? 'Không có tệp phù hợp.' : 'Chưa có ảnh hoặc video. Chọn tải lên để bắt đầu.' }}</div>
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <article v-for="row in store.filteredRows" :key="row.path" class="min-w-0 overflow-hidden rounded-xl border border-[#cbd9c6] bg-white">
          <div class="flex aspect-video items-center justify-center bg-[#eaf1e5]">
            <img v-if="row.kind === 'image'" :src="row.url" :alt="row.name" loading="lazy" class="size-full object-contain" />
            <video v-else :src="row.url" :aria-label="row.name" controls preload="none" playsinline class="size-full object-contain" />
          </div>
          <div class="space-y-3 p-3">
            <div class="break-words text-sm font-bold">{{ row.name }}</div>
            <div class="text-xs text-[#24352a]/70">{{ row.kind === 'image' ? 'Ảnh' : 'Video' }} · {{ formatSize(row.size) }}<br />{{ formatDate(row.createdAt) }}</div>
            <input :value="row.url" readonly :aria-label="`Link ${row.name}`" class="w-full rounded border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1.5 text-xs" @focus="($event.target as HTMLInputElement).select()" />
            <div class="flex items-center justify-between gap-2">
              <button type="button" :aria-label="`Sao chép link ${row.name}`" class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100" @click="store.copyLink(row)">Copy link</button>
              <button type="button" :disabled="store.loading || store.busy" :aria-label="`Xóa ${row.name}`" class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50" @click="store.requestDelete(row)">Xóa</button>
            </div>
          </div>
        </article>
      </div>
    </div>
    <TwoOptionsModal v-if="store.deleting" title="Xóa tệp?" first-text="Hủy" :second-text="store.removing ? 'Đang xóa…' : 'Xóa tệp'" :first-disabled="store.removing" :second-disabled="store.removing" :on-first="store.cancelDelete" :on-second="store.remove" :on-dismiss="store.cancelDelete">
      <div class="break-words text-sm">Xóa “{{ store.deleting.name }}”? Các nội dung đang sử dụng link này sẽ không còn hiển thị tệp. Thao tác không thể hoàn tác.</div>
      <div v-if="store.deleteError" role="alert" class="mt-3 text-sm text-red-700">{{ store.deleteError }}</div>
    </TwoOptionsModal>
  </AdminModal>
</template>
