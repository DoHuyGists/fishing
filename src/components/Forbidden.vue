<script setup lang="ts">
import { t as tr } from "../i18n";

const goBack = () => {
  if (window.history.length > 1) window.history.back()
  else window.location.href = '/'
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-surface px-6 py-16 text-content">
    <section class="w-full max-w-xl" aria-labelledby="error-title">
      <!-- Khung liền nét kèm biểu tượng khóa -->
      <div
        class="relative flex aspect-[16/7] w-full items-center justify-center rounded-2xl border-2 border-border-default bg-border-default/20"
        aria-hidden="true"
      >
        <span class="select-none text-7xl font-semibold tracking-tight sm:text-8xl">403</span>

        <span
          class="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-border-default bg-surface"
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

      <div id="error-title" class="mt-10 text-2xl font-semibold tracking-tight sm:text-3xl">
        {{ tr('Forbidden.ban_khong_co_quyen_truy_cap') }}
      </div>
      <div class="mt-3 max-w-md text-base leading-relaxed text-content/70">
        {{ tr('Forbidden.tai_khoan_hien_tai_chua_duoc_cap_quyen_xem_trang_nay_hay_dang_nh') }}
      </div>

      <div class="mt-8 flex flex-wrap gap-3">
        <a
          href="/login"
          class="inline-flex items-center rounded-lg border border-content bg-content px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-content/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-content"
        >
          {{ tr('Forbidden.dang_nhap_tai_khoan_khac') }}
        </a>
        <button
          type="button"
          class="inline-flex items-center rounded-lg border border-border-default bg-surface px-5 py-2.5 text-sm font-medium text-content transition-colors hover:bg-border-default/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-content"
          @click="goBack"
        >
          {{ tr('Forbidden.quay_lai') }}
        </button>
      </div>
    </section>
  </main>
</template>
