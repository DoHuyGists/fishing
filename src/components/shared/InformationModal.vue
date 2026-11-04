<script setup lang="ts">
import { ref, watch } from "vue";
import { useInformationModal } from "../../composables/useInformationModal";

const { content, close } = useInformationModal();
const dialog = ref<HTMLDialogElement | null>(null);

watch([content, dialog], () => {
  if (content.value) {
    if (dialog.value && !dialog.value.open) dialog.value.showModal();
  } else {
    dialog.value?.close();
  }
}, { flush: "post" });
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      aria-labelledby="information-modal-title"
      aria-describedby="information-modal-description"
      class="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-0 text-[#24352a] shadow-xl backdrop:bg-black/40"
      @cancel.prevent="close"
      @close="close"
      @click.self="close"
    >
      <div v-if="content" class="relative p-6 text-center" @click.stop>
        <button
          type="button"
          autofocus
          aria-label="Đóng thông tin"
          class="absolute right-2 top-2 flex size-8 cursor-pointer items-center justify-center rounded-full text-2xl hover:bg-[#cbd9c6]/50 focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="close"
        >&times;</button>
        <img :src="content.image" :alt="content.name" class="mx-auto mb-4 size-16 object-contain" draggable="false">
        <h2 id="information-modal-title" class="text-lg font-bold">{{ content.name }}</h2>
        <p id="information-modal-description" class="mt-2 whitespace-pre-line text-sm leading-relaxed">{{ content.description }}</p>
      </div>
    </dialog>
  </Teleport>
</template>
