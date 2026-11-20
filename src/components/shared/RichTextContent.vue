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
.rich-text-content :deep(pre) { overflow-x: auto; white-space: pre; border-radius: 0.5rem; background: var(--color-palette-eef2e9); padding: 0.75rem; }
.rich-text-content :deep(img) { display: block; max-width: 100%; height: auto; margin: 0.75rem 0; border-radius: 0.5rem; }
.rich-text-content :deep(video) { display: block; width: 100%; max-height: 70dvh; margin: 0.75rem 0; border-radius: 0.5rem; background: var(--color-black); }
.rich-text-content :deep(a) { color: var(--color-accent); text-decoration: underline; text-underline-offset: 2px; }

.ocean-theme .rich-text-content :deep(pre) {
  color: var(--color-ocean-pearl);
  border: 1px solid #35b9d540;
  background: var(--color-ocean-deep);
}
</style>
