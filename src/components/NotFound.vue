<script setup lang="ts">
import { t as tr } from "../i18n";

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

      <div id="error-title" class="mt-10 text-2xl font-semibold tracking-tight sm:text-3xl">
        {{ tr('NotFound.khong_tim_thay_trang') }}
      </div>
      <div class="mt-3 max-w-md text-base leading-relaxed text-[#24352a]/70">
        {{ tr('NotFound.dia_chi_nay_khong_ton_tai_hoac_da_duoc_chuyen_di_hay_kiem_tra_la') }}
      </div>

      <div class="mt-8 flex flex-wrap gap-3">
        <a
          href="/"
          class="inline-flex items-center rounded-lg border border-[#24352a] bg-[#24352a] px-5 py-2.5 text-sm font-medium text-[#f5f9f0] transition-colors hover:bg-[#24352a]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]"
        >
          {{ tr('Maintenance.ve_trang_chu') }}
        </a>
        <button
          type="button"
          class="inline-flex items-center rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-5 py-2.5 text-sm font-medium text-[#24352a] transition-colors hover:bg-[#cbd9c6]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]"
          @click="goBack"
        >
          {{ tr('Forbidden.quay_lai') }}
        </button>
      </div>
    </section>
  </main>
</template>
