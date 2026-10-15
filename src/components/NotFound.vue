<script setup lang="ts">
const goBack = () => {
  if (window.history.length > 1) window.history.back()
  else window.location.href = '/'
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-[#f5f9f0] px-6 py-16 text-[#24352a]">
    <section class="w-full max-w-xl" aria-labelledby="error-title">
      <!-- Khung nét đứt thể hiện "trang bị thiếu" -->
      <div
        class="flex aspect-[16/7] w-full items-center justify-center rounded-2xl border-2 border-dashed border-[#cbd9c6]"
        aria-hidden="true"
      >
        <span class="select-none text-7xl font-semibold tracking-tight sm:text-8xl">
          4<span class="inline-block -translate-y-1 text-[#24352a]/30">0</span>4
        </span>
      </div>

      <h1 id="error-title" class="mt-10 text-2xl font-semibold tracking-tight sm:text-3xl">
        Không tìm thấy trang
      </h1>
      <p class="mt-3 max-w-md text-base leading-relaxed text-[#24352a]/70">
        Địa chỉ này không tồn tại hoặc đã được chuyển đi. Hãy kiểm tra lại đường dẫn
        hoặc quay về trang trước đó.
      </p>

      <div class="mt-8 flex flex-wrap gap-3">
        <a
          href="/"
          class="inline-flex items-center rounded-lg border border-[#24352a] bg-[#24352a] px-5 py-2.5 text-sm font-medium text-[#f5f9f0] transition-colors hover:bg-[#24352a]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]"
        >
          Về trang chủ
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
