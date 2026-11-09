<script setup lang="ts">
import { onMounted } from "vue";
import Modal from "../../shared/Modal.vue";
import RichTextContent from "../../shared/RichTextContent.vue";
import { useGuideStore } from "../../../stores/guide";
import { useModalStore } from "../../../stores/modal";
import { useOnboardingStore } from "../../../stores/onboarding";

const guideStore = useGuideStore();
const modalStore = useModalStore();
const onboarding = useOnboardingStore();

function startPlayingGuide() {
  modalStore.close();
  onboarding.visible = true;
}

onMounted(() => guideStore.loadGuides());
</script>

<template>
  <Modal
    title="Chỉ dẫn cơ bản"
    sub-title="Chọn một chủ đề để xem hướng dẫn"
    :show-count-data="false"
    :on-refresh="guideStore.loadGuides"
  >
    <div class="flex h-full min-h-0 flex-col">
    <div class="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-[#24352a]">
      <p class="text-sm">Xem hướng dẫn từng bước ngay tại sảnh.</p>
      <button
        type="button"
        class="shrink-0 rounded-xl border border-[#cbd9c6] bg-white px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors hover:border-[#70a77e] hover:bg-[#eaf5e8]"
        @click="startPlayingGuide"
      >
        Hướng dẫn chơi
      </button>
    </div>
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Chỉ dẫn cơ bản"
      :aria-busy="guideStore.loading"
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] text-[#24352a]"
    >
      <p v-if="guideStore.loading" role="status" class="p-5 text-sm">Đang tải hướng dẫn...</p>
      <div v-else-if="guideStore.loadError" role="alert" class="p-5 text-sm text-red-700">
        <p>{{ guideStore.loadError }}</p>
        <button type="button" class="mt-2 font-bold underline" @click="guideStore.loadGuides">Thử lại</button>
      </div>
      <p v-else-if="!guideStore.guides.length" class="p-5 text-sm">Chưa có hướng dẫn nào.</p>
      <div v-else class="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav
          aria-label="Danh sách chỉ dẫn"
          class="max-h-48 shrink-0 overflow-y-auto border-b border-[#cbd9c6] sm:max-h-none sm:w-64 sm:border-r sm:border-b-0 lg:w-80"
        >
          <button
            v-for="guide in guideStore.guides"
            :key="guide.id"
            type="button"
            :aria-current="guideStore.selectedId === guide.id ? 'true' : undefined"
            aria-controls="guide-content"
            class="block w-full break-words border-b border-[#cbd9c6] px-4 py-3 text-left text-sm transition-colors hover:bg-[#eaf5e8] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700"
            :class="guideStore.selectedId === guide.id ? 'bg-[#e0eedb] font-bold' : ''"
            @click="guideStore.selectGuide(guide.id)"
          >
            {{ guide.title }}
          </button>
        </nav>
        <article id="guide-content" aria-live="polite" class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <template v-if="guideStore.selectedGuide">
            <div class="break-words text-xl font-bold">{{ guideStore.selectedGuide.title }}</div>
            <RichTextContent class="mt-4" :content="guideStore.selectedGuide.content" />
          </template>
          <p v-else class="text-sm">Chọn một chỉ dẫn để xem nội dung.</p>
        </article>
      </div>
    </section>
    </div>
  </Modal>
</template>
