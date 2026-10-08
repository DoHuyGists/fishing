<script setup lang="ts">
import { onMounted } from 'vue'
import { useFeedbackStore } from '../../stores/feedback'

const emit = defineEmits<{ close: [] }>()
const store = useFeedbackStore()
onMounted(() => store.fetchOpinionFeedback())

function formatDate(value: string) {
  return new Date(value).toLocaleString('vi-VN')
}
</script>

<template>
  <div class="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 p-1 sm:p-2" @click.self="emit('close')">
    <section role="dialog" aria-modal="true" aria-labelledby="feedback-list-title" class="flex h-full max-h-full w-full max-w-none flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
        <div><h2 id="feedback-list-title" class="text-lg font-bold text-[#153221]">Danh sách góp ý</h2><p class="text-sm text-slate-500">Các phản hồi được gửi từ người chơi.</p></div>
        <div class="flex gap-2"><button type="button" class="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" :disabled="store.loadingOpinion" @click="store.fetchOpinionFeedback()">Tải lại</button><button type="button" aria-label="Đóng" class="h-9 w-9 rounded-full text-2xl leading-none hover:bg-slate-100" @click="emit('close')">&times;</button></div>
      </header>
      <div class="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <p v-if="store.adminError" role="alert" class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ store.adminError }}</p>
        <p v-if="store.loadingOpinion" class="py-10 text-center text-sm text-slate-500">Đang tải góp ý…</p>
        <p v-else-if="!store.opinionFeedback.length" class="py-10 text-center text-sm text-slate-500">Chưa có góp ý nào.</p>
        <div v-else class="space-y-4">
          <article v-for="item in store.opinionFeedback" :key="item.id" class="rounded-xl border border-slate-200 p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2"><span class="text-xs text-slate-500">{{ formatDate(item.created_at) }} · Người dùng {{ item.user_id ?? 'đã xóa tài khoản' }}</span><span class="font-mono text-xs text-slate-400">{{ item.id }}</span></div>
            <div class="grid gap-3 md:grid-cols-2"><div><h3 class="text-xs font-semibold uppercase tracking-wide text-emerald-800">Điều người chơi thích</h3><p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{{ item.like }}</p></div><div><h3 class="text-xs font-semibold uppercase tracking-wide text-amber-800">Điều chưa hài lòng</h3><p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{{ item.dislike }}</p></div></div>
            <div v-if="item.contribute" class="mt-3 border-t border-slate-100 pt-3"><h3 class="text-xs font-semibold uppercase tracking-wide text-indigo-800">Ý tưởng</h3><p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{{ item.contribute }}</p></div>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
