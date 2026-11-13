<script setup lang="ts">
import AdminModal from "../AdminModal.vue";
import Pagination from '../../shared/Pagination.vue';
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
        <div v-if="store.error" role="alert" class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ store.error }}
        </div>
        <div v-if="store.loading" class="py-10 text-center text-sm text-slate-500">Đang tải góp ý…</div>
        <div v-else-if="!store.opinionFeedback.length" class="py-10 text-center text-sm text-slate-500">
          Chưa có góp ý nào.
        </div>
        <div v-else class="space-y-4">
          <article v-for="item in store.opinionFeedback" :key="item.id" class="rounded-xl border border-slate-200 p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs text-slate-500"
                >{{ formatDate(item.created_at) }} · Người dùng {{ item.user_id ?? "đã xóa tài khoản" }}</span
              ><span class="font-mono text-xs text-slate-400">{{ item.id }}</span>
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <div class="text-xs font-semibold uppercase tracking-wide text-emerald-800">Điều người chơi thích</div>
                <div class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{{ item.like }}</div>
              </div>
              <div>
                <div class="text-xs font-semibold uppercase tracking-wide text-amber-800">Điều chưa hài lòng</div>
                <div class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{{ item.dislike }}</div>
              </div>
            </div>
            <div v-if="item.contribute" class="mt-3 border-t border-slate-100 pt-3">
              <div class="text-xs font-semibold uppercase tracking-wide text-indigo-800">Ý tưởng</div>
              <div class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{{ item.contribute }}</div>
            </div>
          </article>
        </div>
      </div>
    <Pagination :page="store.page" :page-size="store.pageSize" :total="store.total" :loading="store.loading" @change="store.fetchOpinionFeedback($event)" />
  </AdminModal>
</template>
