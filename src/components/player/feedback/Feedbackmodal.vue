<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useAuthStore } from "../../../stores/auth";
import { useFeedbackStore } from "../../../stores/feedback";
import { useModalStore } from "../../../stores/modal.ts";
import Modal from "../../shared/Modal.vue";
import OpinionFeedbackForm from "./OpinionFeedbackForm.vue";
import ErrorFeedbackForm from "./ErrorFeedbackForm.vue";
import Tab from "../../shared/Tab.vue";

const SUCCESS_MESSAGE = "Cảm ơn bạn đã gửi phản hồi!";
const modalStore = useModalStore();
const feedbackStore = useFeedbackStore();
const auth = useAuthStore();
const currentActiveTab = ref<"opinion" | "error" | "history">("opinion");
const statusLabels = { pending: 'Chờ xử lý', processing: 'Đang xử lý', resolved: 'Đã giải quyết', closed: 'Đã đóng' };
onMounted(() => feedbackStore.watchMyErrors(auth.userId));
const tabs = [
  { key: "opinion", label: "Góp ý" },
  { key: "error", label: "Báo lỗi" },
  { key: "history", label: "Báo lỗi của tôi" },
];
const toastVisible = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function showToast() {
  toastVisible.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
    modalStore.close();
  }, 6000);
}

function close() {
  modalStore.close();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") close();
}

document.addEventListener("keydown", onKeydown);
onBeforeUnmount(() => {
  feedbackStore.stopWatchingErrors();
  document.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
  clearTimeout(toastTimer);
});
</script>

<template>
  <Modal title="Phản hồi" sub-title="Chia sẻ ý kiến hoặc báo lỗi để chúng tôi cải thiện trò chơi." :on-refresh="() => feedbackStore.loadMyErrors(auth.userId)">
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gửi phản hồi"
      class="flex w-full flex-col rounded-t-2xl bg-white sm:rounded-2xl"
    >
      <Tab v-model="currentActiveTab" :tabs="tabs">
        <template #opinion>
          <OpinionFeedbackForm @submitted="showToast" />
        </template>
        <template #error>
          <ErrorFeedbackForm @submitted="showToast" />
        </template>
        <template #history>
          <section class="space-y-3 p-4 text-sm text-[#24352a]">
            <button type="button" class="underline" :disabled="feedbackStore.historyLoading" @click="feedbackStore.loadMyErrors(auth.userId)">Tải lại</button>
            <div v-if="feedbackStore.historyError" role="alert" class="text-red-700">{{ feedbackStore.historyError }}</div>
            <div v-if="feedbackStore.historyLoading">Đang tải báo lỗi…</div>
            <div v-else-if="!feedbackStore.myErrors.length && !feedbackStore.historyError">Bạn chưa gửi báo lỗi nào.</div>
            <article v-for="item in feedbackStore.myErrors" :key="item.id" class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-4">
              <div class="flex flex-wrap justify-between gap-2"><div class="font-bold">{{ item.title }}</div><span>{{ statusLabels[item.status] || item.status }}</span></div>
              <div class="mt-2 whitespace-pre-wrap">{{ item.description }}</div>
              <div class="mt-2 text-xs text-gray-600">Gửi: {{ new Date(item.created_at).toLocaleString('vi-VN') }} · Cập nhật: {{ new Date(item.updated_at).toLocaleString('vi-VN') }}</div>
            </article>
            <div class="flex items-center gap-4"><button :disabled="feedbackStore.page <= 1 || feedbackStore.historyLoading" class="underline disabled:opacity-40" @click="feedbackStore.loadMyErrors(auth.userId, feedbackStore.page - 1)">Trước</button><span>Trang {{ feedbackStore.page }}</span><button :disabled="!feedbackStore.hasNext || feedbackStore.historyLoading" class="underline disabled:opacity-40" @click="feedbackStore.loadMyErrors(auth.userId, feedbackStore.page + 1)">Sau</button></div>
          </section>
        </template>
      </Tab>
    </div>
  </Modal>

  <div
    v-if="toastVisible"
    role="status"
    aria-live="polite"
    class="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6 sm:mx-0"
  >
    <svg class="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.86-9.64a.75.75 0 0 0-1.22-.87l-3.24 4.53-1.8-1.8a.75.75 0 0 0-1.06 1.06l2.4 2.4a.75.75 0 0 0 1.14-.09l3.78-5.23Z"
        clip-rule="evenodd"
      />
    </svg>
    <div class="flex-1 leading-relaxed">{{ SUCCESS_MESSAGE }}</div>
    <button
      type="button"
      class="-mr-1 rounded p-1 text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      aria-label="Đóng thông báo"
      @click="toastVisible = false"
    >
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 0 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 0 0-1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
        />
      </svg>
    </button>
  </div>
</template>
