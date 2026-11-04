<script setup lang="ts">
import { useId } from "vue";
import { useDocumentScrollLock } from "../../composables/useDocumentScrollLock";

useDocumentScrollLock();

withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  icon?: string;
  closeDisabled?: boolean;
  zIndex?: number;
}>(), {
  subtitle: "",
  icon: "",
  closeDisabled: false,
  zIndex: 50,
});

const emit = defineEmits<{ close: [] }>();
const titleId = useId();
</script>

<template>
  <section
    class="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[#f5f9f0] text-[#24352a]"
    :style="{ zIndex }"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
  >
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-[#cbd9c6] bg-[#153221] px-4 py-3 text-white sm:px-6">
      <div class="flex min-w-0 items-center gap-3">
        <span
          v-if="icon"
          class="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-800 text-xl"
          aria-hidden="true"
        >{{ icon }}</span>
        <div class="min-w-0">
          <h2 :id="titleId" class="m-0 break-words text-lg font-extrabold">{{ title }}</h2>
          <p v-if="subtitle || $slots.subtitle" class="m-0 mt-0.5 break-words text-xs text-emerald-200">
            <slot name="subtitle">{{ subtitle }}</slot>
          </p>
        </div>
      </div>
      <button
        type="button"
        title="Đóng"
        aria-label="Đóng"
        :disabled="closeDisabled"
        class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-emerald-600 bg-emerald-900/50 text-xl hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        @click="emit('close')"
      >&times;</button>
    </header>
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <slot />
    </div>
  </section>
</template>
