<script setup lang="ts">
import { t as tr } from "../i18n";

import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import supabase from "../database/connection";
import { useAuthStore } from "../stores/auth";
import LanguageSelector from "../components/shared/LanguageSelector.vue";

const router = useRouter();
const form = reactive({ email: "", password: "", confirmPassword: "" });
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref("");
const confirmationSent = ref(false);
const resent = ref(false);
async function resend() {
  if (loading.value) return;
  loading.value = true; errorMessage.value = "";
  try { await useAuthStore().resendConfirmation(form.email); resent.value = true; }
  catch (err) { errorMessage.value = err instanceof Error ? err.message : tr('SignUpView.khong_the_gui_lai_email'); }
  finally { loading.value = false; }
}

async function submit() {
  errorMessage.value = "";

  if (form.password !== form.confirmPassword) {
    errorMessage.value = tr('auth.mat_khau_xac_nhan_khong_khop');
    return;
  }

  loading.value = true;
  try {
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { emailRedirectTo: `${window.location.origin}` },
    });

    if (error) {
      errorMessage.value = error.message;
      return;
    }

    if (data.session) {
      await router.replace("/");
      return;
    }

    confirmationSent.value = true;
  } catch {
    errorMessage.value = tr('SignUpView.khong_the_tao_tai_khoan_luc_nay_vui_long_thu_lai');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-[var(--color-ocean-deep)] bg-[radial-gradient(ellipse_at_12%_0%,rgba(53,185,213,0.22),transparent_50%),radial-gradient(ellipse_at_100%_100%,rgba(29,84,117,0.8),transparent_55%)] px-6 py-8 text-[var(--color-ocean-pearl)]">
    <section class="player-popup-in w-full max-w-[408px] rounded-3xl border border-[var(--color-ocean-gold)]/60 bg-[linear-gradient(145deg,var(--color-ocean-panel),var(--color-ocean-deep))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(245,235,212,0.12)] sm:p-[42px]" aria-labelledby="signup-title">
      <LanguageSelector />
      <div class="mb-[5px] mt-7 text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-ocean-cyan)]">{{ tr('SignUpView.bat_dau_hanh_trinh') }}</div>
      <div id="signup-title" class="mb-7 font-serif text-[34px] leading-tight text-[var(--color-ocean-gold)]">{{ tr('SignUpView.tao_tai_khoan') }}</div>

      <div v-if="confirmationSent" class="leading-relaxed text-[var(--color-ocean-pearl)]/80" role="status">
        <button type="button" :disabled="loading" class="my-3 text-sm text-[var(--color-ocean-cyan)] underline underline-offset-4" @click="resend">{{ loading ? tr('ErrorFeedbackForm.dang_gui') : tr('SignUpView.gui_lai_email_xac_nhan') }}</button>
        <div v-if="resent">{{ tr('SignUpView.da_gui_lai_email_xac_nhan') }}</div>
        <div v-if="errorMessage" role="alert" class="text-red-300">{{ errorMessage }}</div>
        <div class="mb-2 font-serif text-[22px] text-[var(--color-ocean-gold)]">{{ tr('SignUpView.kiem_tra_email_cua_ban') }}</div>
        <div class="mb-[18px]">{{ tr('SignUpView.chung_toi_da_gui_lien_ket_xac_nhan_den') }} <strong class="text-[var(--color-ocean-pearl)]">{{ form.email }}</strong>{{ tr('SignUpView.hay_xac_nhan_dia_chi_email_de_hoan_tat_dang_ky') }}</div>
        <RouterLink class="font-bold text-[var(--color-ocean-gold)] underline decoration-transparent underline-offset-4 transition hover:decoration-current" to="/login">{{ tr('SignUpView.quay_lai_dang_nhap') }}</RouterLink>
      </div>

      <form v-else class="grid gap-[18px]" @submit.prevent="submit">
        <label class="grid gap-[7px] text-sm font-bold">
          <span>Email</span>
          <input v-model.trim="form.email" class="min-h-[46px] w-full rounded-xl border border-[var(--color-ocean-cyan)]/35 bg-[var(--color-ocean-deep)] px-3 py-[10px] font-normal text-[var(--color-ocean-pearl)] outline-none transition placeholder:text-[var(--color-ocean-pearl)]/45 focus:border-[var(--color-ocean-cyan)] focus:ring-[3px] focus:ring-[var(--color-ocean-cyan)]/20" type="email" autocomplete="email" required placeholder="...@gmail.com" />
        </label>
        <label class="grid gap-[7px] text-sm font-bold">
          <span>{{ tr('LoginView.mat_khau') }}</span>
          <div class="relative">
            <input v-model="form.password" class="min-h-[46px] w-full rounded-xl border border-[var(--color-ocean-cyan)]/35 bg-[var(--color-ocean-deep)] py-[10px] pl-3 pr-14 font-normal text-[var(--color-ocean-pearl)] outline-none transition placeholder:text-[var(--color-ocean-pearl)]/45 focus:border-[var(--color-ocean-cyan)] focus:ring-[3px] focus:ring-[var(--color-ocean-cyan)]/20" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" minlength="6" required :placeholder="tr('SignUpView.it_nhat_6_ky_tu')" />
            <button class="absolute inset-y-0 right-0 rounded-r-xl px-3 text-xs font-bold text-[var(--color-ocean-cyan)] hover:text-[var(--color-ocean-gold)]" type="button" :aria-label="showPassword ? tr('LoginView.an_mat_khau') : tr('LoginView.hien_mat_khau')" @click="showPassword = !showPassword">{{ showPassword ? tr('FishingBag.an') : tr('LoginView.hien') }}</button>
          </div>
        </label>
        <label class="grid gap-[7px] text-sm font-bold">
          <span>{{ tr('SignUpView.nhap_lai_mat_khau') }}</span>
          <input v-model="form.confirmPassword" class="min-h-[46px] w-full rounded-xl border border-[var(--color-ocean-cyan)]/35 bg-[var(--color-ocean-deep)] px-3 py-[10px] font-normal text-[var(--color-ocean-pearl)] outline-none transition placeholder:text-[var(--color-ocean-pearl)]/45 focus:border-[var(--color-ocean-cyan)] focus:ring-[3px] focus:ring-[var(--color-ocean-cyan)]/20" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required :placeholder="tr('SignUpView.nhap_lai_mat_khau')" />
        </label>
        <div v-if="errorMessage" class="-mt-1 text-[13px] leading-relaxed text-red-300" role="alert">{{ errorMessage }}</div>
        <button class="min-h-12 rounded-xl border border-[var(--color-ocean-gold)] bg-[var(--color-ocean-gold)] font-bold text-[var(--color-ocean-deep)] shadow-[0_4px_0_rgba(147,100,63,0.75)] transition hover:brightness-110 active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ocean-cyan)] disabled:cursor-wait disabled:opacity-70" type="submit" :disabled="loading">
          {{ loading ? tr('SignUpView.dang_tao_tai_khoan') : tr('LoginView.dang_ky') }}
        </button>
      </form>

      <div v-if="!confirmationSent" class="mt-6 text-center text-sm text-[var(--color-ocean-pearl)]/75">{{ tr('SignUpView.da_co_tai_khoan') }}
        <RouterLink class="font-bold text-[var(--color-ocean-gold)] underline decoration-transparent underline-offset-4 transition hover:decoration-current" to="/login">{{ tr('LoginView.dang_nhap') }}</RouterLink>
      </div>
    </section>
  </main>
</template>
