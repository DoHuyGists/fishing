<script setup lang="ts">
const goBack = () => {
  if (window.history.length > 1) window.history.back()
  else window.location.href = '/'
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-[#f5f9f0] px-6 py-16 text-[#24352a]">
    <section class="w-full max-w-xl" aria-labelledby="error-title">
      <!-- Khung liền nét kèm biểu tượng khóa -->
      <div
        class="relative flex aspect-[16/7] w-full items-center justify-center rounded-2xl border-2 border-[#cbd9c6] bg-[#cbd9c6]/20"
        aria-hidden="true"
      >
        <span class="select-none text-7xl font-semibold tracking-tight sm:text-8xl">403</span>

        <span
          class="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-[#cbd9c6] bg-[#f5f9f0]"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
      </div>

      <h1 id="error-title" class="mt-10 text-2xl font-semibold tracking-tight sm:text-3xl">
        Bạn không có quyền truy cập
      </h1>
      <p class="mt-3 max-w-md text-base leading-relaxed text-[#24352a]/70">
        Tài khoản hiện tại chưa được cấp quyền xem trang này. Hãy đăng nhập bằng tài khoản
        khác hoặc liên hệ quản trị viên để được cấp quyền.
      </p>

      <div class="mt-8 flex flex-wrap gap-3">
        <a
          href="/login"
          class="inline-flex items-center rounded-lg border border-[#24352a] bg-[#24352a] px-5 py-2.5 text-sm font-medium text-[#f5f9f0] transition-colors hover:bg-[#24352a]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]"
        >
          Đăng nhập tài khoản khác
        </a>
        <button
          type="button"
          class="inline-flex items-center rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-5 py-2.5 text-sm font-medium text-[#24352a] transition-colors hover:bg-[#cbd9c6]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]"
          @click="goBack"
        >
          Quay lại
        </button>
      </div>
    </section>
  </main>
</template>
