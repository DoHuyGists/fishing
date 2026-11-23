<script setup lang="ts">
import { ref } from "vue";
import { t as tr } from "../../i18n";
import type { HomeImageProps } from "../../types/model/home";

const props = withDefaults(defineProps<HomeImageProps>(), { priority: false, fit: "cover" });
const failedSource = ref("");
</script>

<template>
  <div class="grid overflow-hidden bg-primary">
    <img
      v-if="failedSource !== props.src"
      :src="props.src"
      :srcset="props.srcset"
      :sizes="props.sizes"
      :alt="props.alt"
      :width="props.width"
      :height="props.height"
      :loading="props.priority ? 'eager' : 'lazy'"
      :fetchpriority="props.priority ? 'high' : 'auto'"
      decoding="async"
      class="h-full w-full"
      :class="props.fit === 'contain' ? 'object-contain' : 'object-cover'"
      @error="failedSource = props.src"
    />
    <div v-else role="img" :aria-label="props.alt" class="flex h-full min-h-28 flex-col items-center justify-center gap-3 p-5 text-center text-content">
      <svg viewBox="0 0 32 24" class="h-8 w-10" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <rect x="1" y="1" width="30" height="22" rx="3" />
        <circle cx="10" cy="8" r="2.5" />
        <path d="m2 20 8-7 6 5 6-8 9 10" />
      </svg>
      <span class="text-sm">{{ tr("HomeView.image_unavailable") }}</span>
    </div>
  </div>
</template>
