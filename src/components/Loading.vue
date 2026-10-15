<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Nội dung hiển thị bên dưới vòng xoay */
    text?: string
    /** Phủ toàn màn hình (true) hoặc chỉ chiếm vùng chứa (false) */
    fullscreen?: boolean
  }>(),
  {
    text: 'Đang tải',
    fullscreen: true,
  },
)
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    :class="[
      'flex items-center justify-center bg-[#f5f9f0] px-6 text-[#24352a]',
      fullscreen ? 'fixed inset-0 z-50 min-h-screen' : 'min-h-[240px] w-full',
    ]"
  >
    <div class="flex flex-col items-center gap-5">
      <!-- Vòng xoay: đường viền nhạt + cung đậm chạy quanh -->
      <span
        class="loading-ring h-12 w-12 rounded-full border-[3px] border-[#cbd9c6] border-t-[#24352a]"
        aria-hidden="true"
      />

      <p class="flex items-baseline text-sm font-medium text-[#24352a]/70">
        {{ text }}
        <span class="loading-dots ml-0.5 inline-flex" aria-hidden="true">
          <span>.</span><span>.</span><span>.</span>
        </span>
      </p>

      <span class="sr-only">Vui lòng chờ trong giây lát</span>
    </div>
  </div>
</template>

<style scoped>
.loading-ring {
  animation: loading-spin 0.9s linear infinite;
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
