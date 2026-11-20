<script setup lang="ts">
import { t as tr } from "../i18n";

import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import LanguageSelector from "../components/shared/LanguageSelector.vue";

const router = useRouter();
const auth = useAuthStore();
const form = reactive({ email: "", password: "" });
const showPassword = ref(false);

async function submit() {
  const isSignedIn = await auth.signIn(form);
  if (isSignedIn) router.replace("/");
}
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-palette-dcebe4 bg-[linear-gradient(115deg,rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(25deg,rgba(52,100,87,0.08)_1px,transparent_1px)] bg-size-[24px_24px,32px_32px] px-6 py-8 text-palette-18312d">
    <section class="w-full max-w-[408px] rounded-lg border border-palette-b8cbc3 bg-palette-fffdf8 p-8 shadow-[12px_12px_0_var(--color-brand-secondary)] sm:p-[42px]" aria-labelledby="login-title">
      <LanguageSelector />
      <div class="mb-[5px] mt-7 text-xs font-bold uppercase tracking-[0.08em] text-palette-b9522c">{{ tr('LoginView.chao_mung_tro_lai') }}</div>
      <div id="login-title" class="font-serif text-[34px] leading-tight">{{ tr('LoginView.dang_nhap') }}</div>

      <form class="grid gap-[18px]" @submit.prevent="submit">
        <label class="grid gap-[7px] text-sm font-bold">
          <span>Email</span>
          <input v-model.trim="form.email" class="min-h-[46px] w-full rounded border border-palette-9eb3aa bg-white px-3 py-[10px] font-normal outline-none transition focus:border-brand-secondary focus:ring-[3px] focus:ring-brand-secondary/20" type="email" autocomplete="email" required placeholder="...@gmail.com" />
        </label>
        <label class="grid gap-[7px] text-sm font-bold">
          <span>{{ tr('LoginView.mat_khau') }}</span>
          <div class="relative">
            <input v-model="form.password" class="min-h-[46px] w-full rounded border border-palette-9eb3aa bg-white py-[10px] pl-3 pr-14 font-normal outline-none transition focus:border-brand-secondary focus:ring-[3px] focus:ring-brand-secondary/20" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" required :placeholder="tr('LoginView.nhap_mat_khau')" />
            <button class="absolute inset-y-0 right-0 px-3 text-xs font-bold text-brand-secondary" type="button" :aria-label="showPassword ? tr('LoginView.an_mat_khau') : tr('LoginView.hien_mat_khau')" @click="showPassword = !showPassword">{{ showPassword ? tr('FishingBag.an') : tr('LoginView.hien') }}</button>
          </div>
        </label>
        <div v-if="auth.error" class="-mt-1 text-[13px] leading-relaxed text-palette-b52d26" role="alert">{{ auth.error }}</div>
        <button class="min-h-12 rounded bg-brand-secondary font-bold text-white transition-colors hover:bg-palette-254b40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary disabled:cursor-wait disabled:opacity-70" type="submit" :disabled="auth.loading">
          {{ auth.loading ? tr('LoginView.dang_dang_nhap') : tr('LoginView.dang_nhap') }}
        </button>
      </form>

      <RouterLink to="/forgot-password" class="mt-4 block text-center text-sm text-brand-secondary underline">{{ tr('LoginView.quen_mat_khau') }}</RouterLink>
      <div class="mt-6 text-center text-sm text-palette-61716d">{{ tr('LoginView.chua_co_tai_khoan') }}
        <RouterLink class="font-bold text-brand-secondary underline decoration-transparent underline-offset-4 transition hover:decoration-current" to="/signup">{{ tr('LoginView.dang_ky') }}</RouterLink>
      </div>
    </section>
  </main>
</template>
