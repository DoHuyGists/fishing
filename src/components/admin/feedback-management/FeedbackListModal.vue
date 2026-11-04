<script setup lang="ts">
import AdminModal from "../AdminModal.vue";
import { onMounted } from "vue";
import { useFeedbackListStore } from "../../../stores/feedbackList";

const emit = defineEmits<{ close: [] }>();
const store = useFeedbackListStore();
onMounted(() => store.fetchOpinionFeedback());

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}
</script>

<template>
  <AdminModal
    title="Danh sách góp ý"
    subtitle="Các phản hồi được gửi từ người chơi."
    :z-index="10000"
    @close="emit('close')"
  >
    <div class="flex shrink-0 justify-end border-b border-[#cbd9c6] bg-white px-4 py-3 sm:px-6">
      <button
        type="button"
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        :disabled="store.loading"
        @click="store.fetchOpinionFeedback()"
      >
        Tải lại
      </button>
    </div>
      <div class="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <p v-if="store.error" role="alert" class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ store.error }}
        </p>
        <p v-if="store.loading" class="py-10 text-center text-sm text-slate-500">Đang tải góp ý…</p>
        <p v-else-if="!store.opinionFeedback.length" class="py-10 text-center text-sm text-slate-500">
          Chưa có góp ý nào.
        </p>
        <div v-else class="space-y-4">
          <article v-for="item in store.opinionFeedback" :key="item.id" class="rounded-xl border border-slate-200 p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs text-slate-500"
                >{{ formatDate(item.created_at) }} · Người dùng {{ item.user_id ?? "đã xóa tài khoản" }}</span
              ><span class="font-mono text-xs text-slate-400">{{ item.id }}</span>
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <h3 class="text-xs font-semibold uppercase tracking-wide text-emerald-800">Điều người chơi thích</h3>
                <p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{{ item.like }}</p>
              </div>
              <div>
                <h3 class="text-xs font-semibold uppercase tracking-wide text-amber-800">Điều chưa hài lòng</h3>
                <p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{{ item.dislike }}</p>
              </div>
            </div>
            <div v-if="item.contribute" class="mt-3 border-t border-slate-100 pt-3">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-indigo-800">Ý tưởng</h3>
              <p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{{ item.contribute }}</p>
            </div>
          </article>
        </div>
      </div>
  </AdminModal>
</template>
