<script setup lang="ts">
import type { EventThumbnailProps as Props } from "../../../types/model/event";
import { t as tr } from "../../../i18n";

import { computed, ref, watch } from "vue";

const props = withDefaults(defineProps<Props>(), {
  src: "",
  alt: "",
  width: 120,
  height: 140,
  rotate: -8,
  radius: 14,
  border: 4,
});

const failed = ref(false);

// Reset trạng thái lỗi khi đổi path ảnh
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);

const showImage = computed(() => !!props.src && !failed.value);

const frameStyle = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
  transform: `rotate(${props.rotate}deg)`,
  borderRadius: `${props.radius}px`,
  borderWidth: `${props.border}px`,
}));
</script>

<template>
  <div
    class="box-border shrink-0 select-none overflow-hidden border-solid border-zinc-100 bg-zinc-800 shadow-[0_7px_7px_rgba(0,0,0,0.35)]"
    :style="frameStyle"
  >
    <img
      v-if="showImage && src"
      :src="src"
      :alt="alt"
      draggable="false"
      class="block h-full w-full object-cover hover:scale-125 ease-in-out duration-200"
      @error="failed = true"
    />

    <div
      v-else
      role="img"
      :aria-label="tr('EventThumbnail.chua_co_anh')"
      class="flex h-full w-full items-center justify-center bg-linear-to-br from-zinc-700 to-zinc-600 text-zinc-400"
    >
      <svg
        class="w-[36%]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <circle cx="9" cy="10" r="1.8" />
        <path d="M21 16l-5-5-8 8" />
      </svg>
    </div>
  </div>
</template>
