<script setup lang="ts">
import { computed } from "vue";
import { sanitizeGuideContent } from "../../utils/guideContent";

const props = defineProps<{ content: string }>();
const html = computed(() => sanitizeGuideContent(props.content));
</script>

<template>
  <div class="rich-text-content whitespace-pre-wrap break-words text-sm leading-7" v-html="html" />
</template>

<style scoped>
.rich-text-content :deep(div) { min-height: 1.75em; }
.rich-text-content :deep(strong), .rich-text-content :deep(b) { font-weight: 700; }
.rich-text-content :deep(em), .rich-text-content :deep(i) { font-style: italic; }
.rich-text-content :deep([data-guide-list-item] > div) { margin: 0; }
.rich-text-content :deep(pre) { overflow-x: auto; white-space: pre; border-radius: 0.5rem; background: #eef2e9; padding: 0.75rem; }
.rich-text-content :deep(img) { display: block; max-width: 100%; height: auto; margin: 0.75rem 0; border-radius: 0.5rem; }
.rich-text-content :deep(video) { display: block; width: 100%; max-height: 70dvh; margin: 0.75rem 0; border-radius: 0.5rem; background: #000; }
.rich-text-content :deep(a) { color: #047857; text-decoration: underline; text-underline-offset: 2px; }
</style>
