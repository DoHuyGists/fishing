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
  <main class="grid min-h-screen place-items-center bg-primary bg-[radial-gradient(ellipse_at_12%_0%,color-mix(in_srgb,_var(--color-sky)_10%,_transparent),transparent_50%),radial-gradient(ellipse_at_100%_100%,color-mix(in_srgb,_var(--color-gold)_12%,_transparent),transparent_55%)] px-6 py-8 text-content">
    <section class="player-popup-in w-full max-w-[408px] rounded-3xl border border-border-default bg-surface p-8 shadow-xl sm:p-[42px]" aria-labelledby="login-title">
      <LanguageSelector />
      <div class="mb-[5px] mt-7 text-xs font-bold uppercase tracking-[0.08em] text-sky">{{ tr('LoginView.chao_mung_tro_lai') }}</div>
      <div id="login-title" class="mb-7 font-serif text-[34px] leading-tight text-content">{{ tr('LoginView.dang_nhap') }}</div>

      <form class="grid gap-[18px]" @submit.prevent="submit">
        <label class="grid gap-[7px] text-sm font-bold">
          <span>Email</span>
          <input v-model.trim="form.email" class="min-h-[46px] w-full rounded-xl border border-border-default bg-white px-3 py-[10px] font-normal text-content outline-none transition placeholder:text-content/60 focus:border-accent focus:ring-[3px] focus:ring-accent/20" type="email" autocomplete="email" required placeholder="...@gmail.com" />
        </label>
        <label class="grid gap-[7px] text-sm font-bold">
          <span>{{ tr('LoginView.mat_khau') }}</span>
          <div class="relative">
            <input v-model="form.password" class="min-h-[46px] w-full rounded-xl border border-border-default bg-white py-[10px] pl-3 pr-14 font-normal text-content outline-none transition placeholder:text-content/60 focus:border-accent focus:ring-[3px] focus:ring-accent/20" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" required :placeholder="tr('LoginView.nhap_mat_khau')" />
            <button class="absolute inset-y-0 right-0 rounded-r-xl px-3 text-xs font-bold text-sky hover:text-content" type="button" :aria-label="showPassword ? tr('LoginView.an_mat_khau') : tr('LoginView.hien_mat_khau')" @click="showPassword = !showPassword">{{ showPassword ? tr('FishingBag.an') : tr('LoginView.hien') }}</button>
          </div>
        </label>
        <div v-if="auth.error" class="-mt-1 text-[13px] leading-relaxed text-danger" role="alert">{{ auth.error }}</div>
        <button class="min-h-12 rounded-xl border border-gold bg-gold font-bold text-content shadow-sm transition hover:bg-gold/80 active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70" type="submit" :disabled="auth.loading">
          {{ auth.loading ? tr('LoginView.dang_dang_nhap') : tr('LoginView.dang_nhap') }}
        </button>
      </form>

      <RouterLink to="/forgot-password" class="mt-5 block text-center text-sm text-sky underline underline-offset-4 hover:text-content">{{ tr('LoginView.quen_mat_khau') }}</RouterLink>
      <div class="mt-6 text-center text-sm text-content">{{ tr('LoginView.chua_co_tai_khoan') }}
        <RouterLink class="font-bold text-accent underline decoration-transparent underline-offset-4 transition hover:decoration-current" to="/signup">{{ tr('LoginView.dang_ky') }}</RouterLink>
      </div>
    </section>
  </main>
</template>
