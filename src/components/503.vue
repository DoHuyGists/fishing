<script setup lang="ts">
import { ref } from 'vue'

const retrying = ref(false)

const retry = () => {
  retrying.value = true
  // Tải lại trang để thử kết nối lại với máy chủ
  window.setTimeout(() => window.location.reload(), 600)
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-[#f5f9f0] px-6 py-16 text-[#24352a]">
    <section class="w-full max-w-xl" aria-labelledby="error-title">
      <!-- Khung có thanh trạng thái đang bảo trì -->
      <div
        class="relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-[#cbd9c6]"
        aria-hidden="true"
      >
        <span class="select-none text-7xl font-semibold tracking-tight sm:text-8xl">503</span>

        <div class="absolute inset-x-0 bottom-0 h-1.5 bg-[#cbd9c6]/50">
          <div class="h-full w-1/3 animate-[slide_2.4s_ease-in-out_infinite] bg-[#24352a]" />
        </div>
      </div>

      <h1 id="error-title" class="mt-10 text-2xl font-semibold tracking-tight sm:text-3xl">
        Dịch vụ tạm thời gián đoạn
      </h1>
      <p class="mt-3 max-w-md text-base leading-relaxed text-[#24352a]/70">
        Máy chủ đang bảo trì hoặc quá tải. Dữ liệu của bạn không bị ảnh hưởng.
        Vui lòng thử lại sau ít phút.
      </p>

      <div class="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          :disabled="retrying"
          class="inline-flex items-center gap-2 rounded-lg border border-[#24352a] bg-[#24352a] px-5 py-2.5 text-sm font-medium text-[#f5f9f0] transition-colors hover:bg-[#24352a]/90 disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]"
          @click="retry"
        >
          <svg
            v-if="retrying"
            class="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-6.2-8.55" />
          </svg>
          {{ retrying ? 'Đang thử lại' : 'Thử lại' }}
        </button>
        <a
          href="/"
          class="inline-flex items-center rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-5 py-2.5 text-sm font-medium text-[#24352a] transition-colors hover:bg-[#cbd9c6]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]"
        >
          Về trang chủ
        </a>
      </div>
    </section>
  </main>
</template>

<style scoped>
@keyframes slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-spin,
  [class*='animate-[slide'] {
    animation: none;
  }
}
</style>
