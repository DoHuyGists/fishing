<script setup lang="ts">
import { t as tr } from "../i18n";

withDefaults(
  defineProps<{
    /** Nội dung hiển thị bên dưới vòng xoay */
    text?: string
    /** Phủ toàn màn hình (true) hoặc chỉ chiếm vùng chứa (false) */
    fullscreen?: boolean
  }>(),
  {
    get text() { return tr('Loading.dang_tai'); },
    fullscreen: true,
  },
)
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    :class="[
      'loading-screen flex items-center justify-center bg-surface px-6 text-content',
      fullscreen ? 'fixed inset-0 z-50 min-h-screen' : 'min-h-[240px] w-full',
    ]"
  >
    <div class="flex flex-col items-center gap-5">
      <!-- Vòng xoay: đường viền nhạt + cung đậm chạy quanh -->
      <span
        class="loading-ring h-12 w-12 rounded-full border-[3px] border-border-default border-t-content"
        aria-hidden="true"
      />

      <div class="flex items-baseline text-sm font-medium text-content/70">
        {{ text }}
        <span class="loading-dots ml-0.5 inline-flex" aria-hidden="true">
          <span>.</span><span>.</span><span>.</span>
        </span>
      </div>

      <span class="sr-only">{{ tr('Loading.vui_long_cho_trong_giay_lat') }}</span>
    </div>
  </div>
</template>

<style scoped>
.loading-ring {
  animation: loading-spin 0.9s linear infinite;
}

html.ocean-theme .loading-screen {
  background: radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--color-sky) 14%, transparent), transparent 60%), var(--color-ocean-deep);
}

html.ocean-theme .loading-ring {
  border-color: color-mix(in srgb, var(--color-sky) 20%, transparent);
  border-top-color: var(--color-ocean-gold);
}

.loading-dots span {
  animation: loading-blink 1.2s ease-in-out infinite;
}
.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes loading-blink {
  0%,
  80%,
  100% {
    opacity: 0.2;
  }
  40% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-ring {
    animation-duration: 2.4s;
  }
  .loading-dots span {
    animation: none;
    opacity: 1;
  }
}
</style>
