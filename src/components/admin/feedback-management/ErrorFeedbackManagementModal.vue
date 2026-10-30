<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { ErrorFeedbackStatus } from '../../../data/supabaseFeedbackRepository'
import { useErrorFeedbackManagementStore } from '../../../stores/errorFeedbackManagement'

const emit = defineEmits<{ close: [] }>()
const store = useErrorFeedbackManagementStore()
const expandedAttachments = ref<Record<string, boolean>>({})
const statuses: { value: ErrorFeedbackStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã giải quyết' },
  { value: 'closed', label: 'Đã đóng' },
]
onMounted(() => store.fetchErrorFeedback())

watch(
  () => store.errorFeedback.flatMap((item) => item.attachments ?? []).map((file) => file.path).join('|'),
  () => store.fetchAttachmentUrls(store.errorFeedback.flatMap((item) => item.attachments ?? []).map((file) => file.path)),
)

function formatDate(value: string) {
  return new Date(value).toLocaleString('vi-VN')
}

function attachmentUrl(path: string) {
  return store.signedUrls[path] ?? ''
}
</script>

<template>
  <div class="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 p-1 sm:p-2" @click.self="emit('close')">
    <section role="dialog" aria-modal="true" aria-labelledby="error-feedback-title" class="flex h-full max-h-full w-full max-w-none flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
        <div><h2 id="error-feedback-title" class="text-lg font-bold text-[#153221]">Quản lý báo lỗi</h2><p class="text-sm text-slate-500">Xem sự cố, tệp đính kèm và cập nhật trạng thái xử lý.</p></div>
        <div class="flex gap-2"><button type="button" class="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" :disabled="store.loading" @click="store.fetchErrorFeedback()">Tải lại</button><button type="button" aria-label="Đóng" class="h-9 w-9 rounded-full text-2xl leading-none hover:bg-slate-100" @click="emit('close')">&times;</button></div>
      </header>
      <div class="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <p v-if="store.error" role="alert" class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ store.error }}</p>
        <p v-if="store.attachmentError" role="alert" class="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Không thể tạo signed URL cho tệp đính kèm. Kiểm tra quyền đọc Storage của tài khoản admin: {{ store.attachmentError }}</p>
        <p v-else-if="store.loadingAttachments" class="mb-4 text-sm text-slate-500">Đang tạo liên kết an toàn cho tệp đính kèm…</p>
        <p v-if="store.loading" class="py-10 text-center text-sm text-slate-500">Đang tải báo lỗi…</p>
        <p v-else-if="!store.errorFeedback.length" class="py-10 text-center text-sm text-slate-500">Chưa có báo lỗi nào.</p>
        <div v-else class="space-y-4">
          <article v-for="item in store.errorFeedback" :key="item.id" class="rounded-xl border border-slate-200 p-4 sm:p-5">
            <div class="flex flex-col justify-between gap-3 sm:flex-row"><div class="min-w-0"><h3 class="text-base font-bold text-slate-800">{{ item.title }}</h3><p class="mt-1 text-xs text-slate-500">{{ formatDate(item.created_at) }} · Người dùng {{ item.user_id ?? 'đã xóa tài khoản' }}</p></div><label class="flex shrink-0 items-center gap-2 text-sm"><span class="font-medium text-slate-600">Trạng thái</span><select :value="item.status" :disabled="store.updatingIds.includes(item.id)" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none disabled:opacity-60" @change="store.updateErrorStatus(item.id, ($event.target as HTMLSelectElement).value as ErrorFeedbackStatus)"><option v-for="status in statuses" :key="status.value" :value="status.value">{{ status.label }}</option></select><span v-if="store.updatingIds.includes(item.id)" class="text-xs text-slate-500">Đang lưu…</span></label></div>
            <p v-if="item.description" class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{{ item.description }}</p>
            <div v-if="item.attachments?.length" class="mt-4 rounded-lg border border-slate-200">
              <button type="button" class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50" :aria-expanded="!!expandedAttachments[item.id]" :aria-controls="`attachments-${item.id}`" @click="expandedAttachments[item.id] = !expandedAttachments[item.id]">
                <span>Tệp đính kèm ({{ item.attachments.length }})</span>
                <svg class="h-5 w-5 shrink-0 transition-transform" :class="expandedAttachments[item.id] ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>
              </button>
              <div v-if="expandedAttachments[item.id]" :id="`attachments-${item.id}`" class="flex flex-wrap gap-3 border-t border-slate-200 p-3">
                <a v-for="file in item.attachments" :key="file.path" :href="attachmentUrl(file.path) || undefined" target="_blank" rel="noopener noreferrer" class="overflow-hidden rounded-lg border border-slate-200 bg-slate-50" :class="attachmentUrl(file.path) ? '' : 'pointer-events-none opacity-50'"><img v-if="file.type === 'image' && attachmentUrl(file.path)" :src="attachmentUrl(file.path)" :alt="file.path.split('/').pop() ?? 'Ảnh đính kèm'" class="h-32 w-40 object-cover" /><span v-else class="flex h-32 w-48 flex-col justify-center px-4 text-center text-sm text-indigo-700"><span aria-hidden="true" class="mb-1 text-2xl">▶</span>{{ attachmentUrl(file.path) ? 'Mở video' : (store.loadingAttachments ? 'Đang tải…' : 'Không tải được tệp') }}</span></a>
              </div>
            </div>
            <p class="mt-3 text-xs text-slate-400">Cập nhật lần cuối: {{ formatDate(item.updated_at) }}</p>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
