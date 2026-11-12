<script setup lang="ts">
import type { AssetRow } from "../../../types/table/asset";
import { nextTick, onMounted, ref, useId, watch } from "vue";
import AdminModal from "../AdminModal.vue";
import TwoOptionsModal from "../../shared/TwoOptionsModal.vue";
import { ASSET_MIME_TYPES } from "../../../data/supabaseAssetRepository";
import { useAdminAssetsStore } from "./admin-assets-store";

const props = withDefaults(defineProps<{
  selectionMode?: boolean;
  selectionKind?: "all" | "image";
  zIndex?: number;
}>(), { selectionMode: false, selectionKind: "all", zIndex: 50 });
const emit = defineEmits<{ close: []; select: [asset: AssetRow] }>();
const store = useAdminAssetsStore();
const fileInput = ref<HTMLInputElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);
const folderOptionsId = useId();
const viewModes = [
  { value: "list", label: "Danh sách", title: "List" },
  { value: "grid", label: "Lưới", title: "Grid" },
  { value: "tree", label: "Cây", title: "Tree" },
] as const;
const accept = Object.keys(ASSET_MIME_TYPES)
  .filter(mime => props.selectionKind !== "image" || mime.startsWith("image/"))
  .join(",");
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
function escape() {
  if (store.deleting) store.cancelDelete();
  else if (store.folderDialog) store.cancelFolderDialog();
  else close();
}
function selectAsset(row: AssetRow) {
  if (store.loading || store.busy || (props.selectionKind === "image" && row.kind !== "image")) return;
  emit("select", row);
}
watch(() => store.folderDialog, async (dialog) => {
  if (!dialog) return;
  await nextTick();
  folderInput.value?.focus();
  if (dialog.mode !== "create") folderInput.value?.select();
});
onMounted(() => {
  store.resetView();
  if (props.selectionMode) {
    store.kind = props.selectionKind;
    searchInput.value?.focus();
  }
  void store.fetchRows();
});
</script>

<template>
  <AdminModal :title="selectionMode ? (selectionKind === 'image' ? 'Chọn ảnh từ kho' : 'Chọn link ảnh / video') : 'Quản lý ảnh & video'" :subtitle="selectionMode ? 'Tìm hoặc tải tệp lên, rồi chọn Dùng link để đưa vào trình soạn thảo' : 'Lưu trữ và sao chép link để sử dụng trong nội dung'" :z-index="zIndex" :close-disabled="store.busy" @close="close" @keydown.esc.stop.prevent="escape">
    <div class="shrink-0 space-y-3 border-b border-[#cbd9c6] p-4 sm:px-6">
      <div class="flex flex-wrap gap-3">
        <input ref="searchInput" v-model="store.search" type="search" aria-label="Tìm tên tệp" placeholder="Tìm tên tệp…" class="min-w-48 flex-1 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm focus:outline-emerald-700" />
        <select v-if="selectionKind !== 'image'" v-model="store.kind" aria-label="Lọc loại tệp" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm">
          <option value="all">Tất cả</option><option value="image">Ảnh</option><option value="video">Video</option>
        </select>
        <div role="group" aria-label="Chế độ xem" class="flex rounded-lg border border-[#cbd9c6] bg-white p-1">
          <button v-for="mode in viewModes" :key="mode.value" type="button" :title="mode.title" :aria-pressed="store.viewMode === mode.value" :disabled="store.busy" class="rounded-md px-3 py-1 text-sm font-semibold disabled:opacity-50" :class="store.viewMode === mode.value ? 'bg-emerald-800 text-white' : 'hover:bg-[#f5f9f0]'" @click="store.viewMode = mode.value">{{ mode.label }}</button>
        </div>
        <button type="button" :disabled="store.loading || store.busy" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50" @click="store.fetchRows()">{{ store.loading ? 'Đang tải…' : 'Làm mới' }}</button>
        <input ref="fileInput" type="file" multiple :accept="accept" :disabled="store.loading || store.busy" aria-label="Chọn ảnh hoặc video tải lên" class="sr-only" tabindex="-1" @change="selectFiles" />
        <button type="button" :disabled="store.loading || store.busy" class="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50" @click="fileInput?.click()">{{ store.uploading ? 'Đang tải lên…' : selectionKind === 'image' ? '+ Tải ảnh' : '+ Tải ảnh / video' }}</button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <nav aria-label="Đường dẫn thư mục" class="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          <template v-for="(crumb, index) in store.breadcrumbs" :key="crumb.folder">
            <span v-if="index" aria-hidden="true">/</span>
            <button type="button" :disabled="store.loading || store.busy" :aria-current="crumb.folder === store.currentFolder ? 'location' : undefined" class="break-all rounded px-2 py-1 hover:bg-emerald-100 disabled:opacity-50" :class="{ 'font-bold': crumb.folder === store.currentFolder }" @click="store.navigate(crumb.folder)">{{ crumb.name }}</button>
          </template>
        </nav>
        <select :value="store.currentFolder" aria-label="Đi đến thư mục" :disabled="store.loading || store.busy" class="max-w-64 rounded-lg border border-[#cbd9c6] bg-white px-2 py-1.5 text-xs" @change="store.navigate(($event.target as HTMLSelectElement).value)">
          <option value="">Thư mục gốc</option>
          <option v-for="folder in store.folderPaths" :key="folder" :value="folder">{{ folder }}</option>
        </select>
        <button type="button" :disabled="store.loading || store.busy || !!store.error" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50" @click="store.openFolderDialog('create')">+ Tạo thư mục</button>
        <button v-if="store.currentFolder" type="button" :disabled="store.loading || store.busy || !!store.error" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50" @click="store.openFolderDialog('move-folder')">Đổi tên / chuyển thư mục</button>
        <label v-if="store.viewMode !== 'tree'" class="flex items-center gap-2 text-xs">
          <input v-model="store.includeDescendants" type="checkbox" /> Bao gồm thư mục con
        </label>
        <div v-else class="flex items-center gap-2 text-xs">
          <button type="button" class="rounded px-2 py-1 hover:bg-emerald-100" @click="store.expandAll()">Mở tất cả</button>
          <button type="button" class="rounded px-2 py-1 hover:bg-emerald-100" @click="store.collapseAll()">Thu gọn</button>
        </div>
      </div>
      <div class="text-xs text-[#24352a]/70">Tải lên vào: <strong class="break-all">{{ store.currentFolder || 'Thư mục gốc' }}</strong> · {{ store.viewMode === 'tree' || store.includeDescendants ? 'Tìm trong thư mục này và thư mục con.' : 'Tìm trong thư mục này.' }}</div>
      <div class="text-xs text-[#24352a]/70">JPG, PNG, GIF, WebP, AVIF, MP4, WebM, MOV · Tối đa 50 MB/tệp · Link công khai, không hết hạn.</div>
      <div v-if="store.uploading" role="status" aria-live="polite" class="text-sm font-semibold">Đã xử lý {{ store.completed }}/{{ store.total }} tệp. Vui lòng giữ cửa sổ mở.</div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" :aria-busy="store.loading">
      <div v-if="store.error" role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ store.error }}</div>
      <div v-if="store.uploadErrors.length" role="alert" class="mb-4 max-h-48 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <div class="font-semibold">Các tệp chưa tải lên được:</div>
        <div class="mt-2 space-y-1 break-words"><div v-for="(error, index) in store.uploadErrors" :key="index">• {{ error }}</div></div>
      </div>
      <div class="mb-4 text-sm" role="status" aria-live="polite">{{ store.filteredRows.length }} tệp phù hợp · Tổng kho: {{ store.rows.length }} tệp<span v-if="store.viewMode === 'tree' && store.search.trim()"> · Đã mở các nhánh có kết quả tìm kiếm</span></div>
      <div v-if="store.loading && !store.rows.length" role="status" class="py-12 text-center text-sm">Đang tải ảnh và video…</div>
      <div v-else-if="!store.visibleEntries.length && !store.error" class="rounded-xl border border-dashed border-[#cbd9c6] bg-white p-10 text-center text-sm">{{ store.search.trim() || store.kind !== 'all' ? 'Không có tệp phù hợp.' : 'Thư mục chưa có ảnh hoặc video. Chọn tải lên để bắt đầu.' }}</div>
      <div v-else :class="store.viewMode === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-2'">
        <div v-for="entry in store.visibleEntries" :key="entry.key" class="min-w-0" :style="store.viewMode === 'tree' ? { marginLeft: `${Math.min(entry.depth * 20, 160)}px` } : undefined">
          <div v-if="entry.type === 'folder'" class="flex h-full min-w-0 items-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#eaf1e5] p-3">
            <button v-if="store.viewMode === 'tree'" type="button" :aria-label="`${entry.expanded ? 'Thu gọn' : 'Mở rộng'} ${entry.folder}`" :aria-expanded="entry.expanded" class="size-8 shrink-0 rounded border border-[#cbd9c6] bg-white font-bold hover:bg-emerald-100" @click="store.toggleFolder(entry.folder)">{{ entry.expanded ? '−' : '+' }}</button>
            <button type="button" :disabled="store.loading || store.busy" :aria-label="`Mở thư mục ${entry.folder}`" class="min-w-0 flex-1 text-left disabled:opacity-50" @click="store.navigate(entry.folder)">
              <span class="block break-words text-sm font-bold">📁 {{ entry.name }}</span>
              <span class="text-xs text-[#24352a]/70">{{ entry.count }} tệp phù hợp trong nhánh</span>
            </button>
            <button type="button" :disabled="store.loading || store.busy" :aria-label="`Đổi tên hoặc chuyển ${entry.folder}`" class="shrink-0 rounded-lg border border-[#cbd9c6] bg-white px-2 py-1.5 text-xs disabled:opacity-50" @click="store.openFolderDialog('move-folder', entry.folder)">Sửa</button>
          </div>
          <article v-else class="min-w-0 overflow-hidden rounded-xl border border-[#cbd9c6] bg-white" :class="{ 'sm:flex sm:items-center': store.viewMode !== 'grid' }">
            <div class="flex shrink-0 items-center justify-center bg-[#eaf1e5]" :class="store.viewMode === 'grid' ? 'aspect-video' : 'h-32 sm:h-24 sm:w-32'">
              <img v-if="entry.row.kind === 'image'" :src="entry.row.url" :alt="entry.row.name" loading="lazy" class="size-full object-contain" />
              <video v-else :src="entry.row.url" :aria-label="entry.row.name" controls preload="none" playsinline class="size-full object-contain" />
            </div>
            <div class="min-w-0 flex-1 p-3" :class="store.viewMode === 'grid' ? 'space-y-3' : 'flex flex-wrap items-center gap-3'">
              <div class="min-w-0 space-y-1" :class="{ 'min-w-36 flex-1': store.viewMode !== 'grid' }">
                <div class="break-words text-sm font-bold">{{ entry.row.name }}</div>
                <div class="text-xs text-[#24352a]/70">{{ entry.row.kind === 'image' ? 'Ảnh' : 'Video' }} · {{ formatSize(entry.row.size) }} · {{ formatDate(entry.row.createdAt) }}</div>
                <button type="button" :disabled="store.loading || store.busy" class="max-w-full break-all text-left text-xs text-emerald-800 underline disabled:opacity-50" @click="store.navigate(entry.row.folder)">{{ entry.row.folder || 'Thư mục gốc' }}</button>
              </div>
              <input :value="entry.row.url" readonly :aria-label="`Link ${entry.row.name}`" class="min-w-0 rounded border border-[#cbd9c6] bg-[#f5f9f0] px-2 py-1.5 text-xs" :class="store.viewMode === 'grid' ? 'w-full' : 'w-full sm:w-48'" @focus="($event.target as HTMLInputElement).select()" />
              <div class="flex flex-wrap items-center gap-2">
                <button v-if="selectionMode" type="button" :disabled="store.loading || store.busy" :aria-label="`Dùng link ${entry.row.name}`" class="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-50" @click="selectAsset(entry.row)">Dùng link</button>
                <button type="button" :aria-label="`Sao chép link ${entry.row.name}`" class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100" @click="store.copyLink(entry.row)">Copy link</button>
                <button type="button" :disabled="store.loading || store.busy" :aria-label="`Chuyển thư mục cho ${entry.row.name}`" class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50" @click="store.requestMove(entry.row)">Chuyển</button>
                <button type="button" :disabled="store.loading || store.busy" :aria-label="`Xóa ${entry.row.name}`" class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50" @click="store.requestDelete(entry.row)">Xóa</button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
    <TwoOptionsModal v-if="store.folderDialog" :title="store.folderDialog.mode === 'create' ? 'Tạo thư mục' : store.folderDialog.mode === 'move-asset' ? 'Chuyển tệp' : 'Đổi tên / chuyển thư mục'" first-text="Hủy" :second-text="store.savingFolder ? 'Đang lưu…' : 'Lưu'" :first-disabled="store.savingFolder" :second-disabled="store.savingFolder" :on-first="store.cancelFolderDialog" :on-second="store.saveFolder" :on-dismiss="store.cancelFolderDialog">
      <div v-if="store.folderDialog.mode === 'move-asset'" class="mb-3 break-words text-sm">Tệp: {{ store.folderDialog.asset.name }}</div>
      <div v-else-if="store.folderDialog.mode === 'move-folder'" class="mb-3 break-all text-sm">Thư mục hiện tại: {{ store.folderDialog.source }}. Thay đổi áp dụng cho toàn bộ tệp và thư mục con.</div>
      <label class="block text-sm font-semibold">{{ store.folderDialog.mode === 'move-asset' ? 'Thư mục đích (để trống để về gốc)' : 'Đường dẫn đầy đủ của thư mục' }}
        <input ref="folderInput" v-model="store.folderInput" :list="folderOptionsId" :disabled="store.savingFolder" :aria-invalid="!!store.folderError" type="text" placeholder="folder1/folder2/" class="mt-2 w-full rounded-lg border border-[#cbd9c6] px-3 py-2 text-sm" @keydown.enter.prevent="store.saveFolder()" />
      </label>
      <datalist :id="folderOptionsId"><option v-for="folder in store.folderPaths" :key="folder" :value="folder" /></datalist>
      <div class="mt-2 text-xs text-[#24352a]/70">Dùng dấu / để phân cấp. {{ store.folderDialog.mode === 'create' ? 'Thư mục trống chỉ tồn tại trong phiên làm việc; tải tệp vào để lưu thư mục.' : 'Link ảnh/video đang sử dụng sẽ được giữ nguyên.' }}</div>
      <div v-if="store.folderError" role="alert" class="mt-3 break-words text-sm text-red-700">{{ store.folderError }}</div>
    </TwoOptionsModal>
    <TwoOptionsModal v-if="store.deleting" title="Xóa tệp?" first-text="Hủy" :second-text="store.removing ? 'Đang xóa…' : 'Xóa tệp'" :first-disabled="store.removing" :second-disabled="store.removing" :on-first="store.cancelDelete" :on-second="store.remove" :on-dismiss="store.cancelDelete">
      <div class="break-words text-sm">Xóa “{{ store.deleting.name }}”? Các nội dung đang sử dụng link này sẽ không còn hiển thị tệp. Thao tác không thể hoàn tác.</div>
      <div v-if="store.deleteError" role="alert" class="mt-3 text-sm text-red-700">{{ store.deleteError }}</div>
    </TwoOptionsModal>
  </AdminModal>
</template>
