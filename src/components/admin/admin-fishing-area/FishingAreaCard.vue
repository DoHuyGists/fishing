<script setup lang="ts">
import type { FishingAreaRow } from "../../../types/table/fishingArea";

defineProps<{
  area: FishingAreaRow;
  countryName: string;
  imageUrl: string;
  imageFailed: boolean;
  deleting: boolean;
}>();

defineEmits<{
  preview: [event: MouseEvent];
  imageError: [];
  edit: [];
  delete: [];
}>();
</script>

<template>
  <article class="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-2xs text-[11px] text-content">
    <button
      v-if="imageUrl && !imageFailed"
      type="button"
      :aria-label="`Xem ảnh ${area.title || '(Chưa đặt tên)'}`"
      class="block w-full shrink-0 cursor-pointer bg-surface focus-visible:outline-2 focus-visible:outline-accent"
      @click="$emit('preview', $event)"
    >
      <img :src="imageUrl" :alt="area.title || 'Ảnh bãi câu'" loading="lazy" class="aspect-2/1 w-full object-cover" @error="$emit('imageError')" />
    </button>
    <div v-else class="aspect-2/1 flex items-center justify-center bg-surface text-content-muted">
      {{ imageUrl ? 'Không tải được ảnh' : 'Chưa có ảnh' }}
    </div>
    <div class="flex flex-1 flex-col gap-2 p-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 font-bold text-xs wrap-break-word">{{ area.title || '(Chưa đặt tên)' }}</div>
        <span class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold bg-surface" :class="area.isAvailable ? 'border-accent' : 'border-content'">
          {{ area.isAvailable ? 'Hoạt động' : 'Chưa bật' }}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-x-2 gap-y-1 wrap-break-word">
        <span>Quốc gia: {{ countryName || '—' }}</span>
        <span>Vùng câu: {{ area.fishingBoundary?.length || 0 }} điểm</span>
        <span class="col-span-2">Múi giờ: {{ area.timezone || 'Theo quốc gia' }}</span>
        <span>Đo độ sâu: {{ area.allowDepthTool ? 'Bật' : 'Tắt' }}</span>
        <span :class="area.survivalMode ? 'font-bold text-danger' : ''">Sinh tồn: {{ area.survivalMode ? 'Bật' : 'Tắt' }}</span>
      </div>
      <div class="truncate text-content-muted" :title="area.scenePath || ''">Cảnh: {{ area.scenePath || '—' }}</div>
      <div class="text-content-muted">Tạo lúc: {{ area.createdAt ? new Date(area.createdAt).toLocaleString('vi-VN') : '—' }}</div>
      <div class="mt-auto flex justify-end gap-2 border-t border-border pt-2">
        <button type="button" class="px-2.5 py-1 rounded-lg border border-content hover:bg-surface font-bold cursor-pointer transition-colors" @click="$emit('edit')">Sửa</button>
        <button type="button" :disabled="deleting" class="px-2.5 py-1 rounded-lg border border-danger hover:bg-surface text-danger font-bold cursor-pointer transition-colors disabled:opacity-50" @click="$emit('delete')">Xoá</button>
      </div>
    </div>
  </article>
</template>
