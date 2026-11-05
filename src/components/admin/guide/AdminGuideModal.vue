<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import AdminModal from "../AdminModal.vue";
import TensionChallengeIdexGuilde from "./TensionChallengeIdexGuilde.vue";

const emit = defineEmits<{ close: [] }>();
const content = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;

onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  content.value?.focus();
});
onBeforeUnmount(() => previousFocus?.focus());
</script>

<template>
  <AdminModal title="Hướng dẫn quản trị" subtitle="Tension challenge · Giải thích chỉ số và ví dụ cân bằng" icon="📘" :z-index="10000" @close="emit('close')" @keydown.esc.stop.prevent="emit('close')">
    <div ref="content" tabindex="-1" class="min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none">
      <TensionChallengeIdexGuilde />
    </div>
  </AdminModal>
</template>
