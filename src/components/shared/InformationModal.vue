<script setup lang="ts">
import { t as tr } from "../../i18n";

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
      class="shared-information fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-border-default bg-surface p-0 text-content shadow-xl backdrop:bg-content/40"
      @cancel.prevent="close"
      @close="close"
      @click.self="close"
    >
      <div v-if="content" class="relative p-6 text-center" @click.stop>
        <button
          type="button"
          autofocus
          :aria-label="tr('InformationModal.dong_thong_tin')"
          class="absolute right-2 top-2 flex size-8 cursor-pointer items-center justify-center rounded-full text-2xl hover:bg-border-default/50 focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="close"
        >×</button>
        <img v-if="content.image" :src="content.image" :alt="content.name" class="mx-auto mb-4 size-16 object-contain" draggable="false">
        <div id="information-modal-title" class="text-lg font-bold">{{ content.name }}</div>
        <div id="information-modal-description" class="mt-2 whitespace-pre-line text-sm leading-relaxed">{{ content.description }}</div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.ocean-theme .shared-information {
  color: var(--color-ocean-pearl);
  border-color: var(--color-ocean-gold);
  background: linear-gradient(150deg, var(--color-ocean-panel), var(--color-ocean-deep));
  box-shadow: 0 24px 64px color-mix(in srgb, var(--color-content) 60%, transparent), inset 0 1px color-mix(in srgb, var(--color-surface) 14.902%, transparent);
}

.ocean-theme .shared-information::backdrop {
  background: color-mix(in srgb, var(--color-content) 70.196%, transparent);
  backdrop-filter: blur(4px);
}

.ocean-theme .shared-information #information-modal-title {
  color: var(--color-ocean-gold);
}

.ocean-theme .shared-information button:hover {
  color: var(--color-ocean-cyan);
  background: color-mix(in srgb, var(--color-sky) 10.196%, transparent);
}

.ocean-theme .shared-information button:focus-visible {
  outline-color: var(--color-ocean-cyan);
}
</style>
