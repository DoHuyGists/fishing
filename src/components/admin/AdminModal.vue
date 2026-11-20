<script setup lang="ts">
import { useId } from "vue";
import { useDocumentScrollLock } from "../../composables/useDocumentScrollLock";

useDocumentScrollLock();

withDefaults(defineProps<{
  title: string;
  icon?: string;
  closeDisabled?: boolean;
  zIndex?: number;
}>(), {
  icon: "",
  closeDisabled: false,
  zIndex: 50,
});

const emit = defineEmits<{ close: [] }>();
const titleId = useId();
</script>

<template>
  <section
    class="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-surface text-content"
    :style="{ zIndex }"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
  >
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-border-default bg-content-strong px-4 py-3 text-white sm:px-6">
      <div class="flex min-w-0 items-center gap-3">
        <span
          v-if="icon"
          class="grid size-10 shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent text-xl"
          aria-hidden="true"
        >{{ icon }}</span>
        <div :id="titleId" class="m-0 min-w-0 break-words text-lg font-extrabold">{{ title }}</div>
      </div>
      <button
        type="button"
        title="Đóng"
        aria-label="Đóng"
        :disabled="closeDisabled"
        class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-accent bg-accent/50 text-xl hover:bg-accent focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        @click="emit('close')"
      >&times;</button>
    </header>
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <slot />
    </div>
  </section>
</template>
