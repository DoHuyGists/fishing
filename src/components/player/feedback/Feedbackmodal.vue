<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { useModalStore } from "../../../stores/modal.ts";
import Modal from "../../shared/Modal.vue";
import OpinionFeedbackForm from "./OpinionFeedbackForm.vue";
import ErrorFeedbackForm from "./ErrorFeedbackForm.vue";
import Tab from "../../shared/Tab.vue";

const SUCCESS_MESSAGE = "Cảm ơn bạn đã gửi phản hồi!";
const modalStore = useModalStore();
const currentActiveTab = ref<"opinion" | "error">("opinion");
const tabs = [
  { key: "opinion", label: "Góp ý" },
  { key: "error", label: "Báo lỗi" },
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
  document.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
  clearTimeout(toastTimer);
});
</script>

<template>
  <Modal title="Phản hồi" sub-title="Chia sẻ ý kiến hoặc báo lỗi để chúng tôi cải thiện trò chơi.">
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
    <p class="flex-1 leading-relaxed">{{ SUCCESS_MESSAGE }}</p>
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
