<script setup lang="ts">
import { t as tr } from "../i18n";

import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import supabase from "../database/connection";
import { useAuthStore } from "../stores/auth";

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
  <main class="grid min-h-screen place-items-center bg-[#dcebe4] bg-[linear-gradient(115deg,rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(25deg,rgba(52,100,87,0.08)_1px,transparent_1px)] bg-size-[24px_24px,32px_32px] px-6 py-8 text-[#18312d]">
    <section class="w-full max-w-[408px] rounded-lg border border-[#b8cbc3] bg-[#fffdf8] p-8 shadow-[12px_12px_0_#346457] sm:p-[42px]" aria-labelledby="signup-title">
      <div class="mb-[5px] mt-7 text-xs font-bold uppercase tracking-[0.08em] text-[#b9522c]">{{ tr('SignUpView.bat_dau_hanh_trinh') }}</div>
      <div id="signup-title" class="font-serif text-[34px] leading-tight">{{ tr('SignUpView.tao_tai_khoan') }}</div>

      <div v-if="confirmationSent" class="leading-relaxed text-[#61716d]" role="status">
        <button type="button" :disabled="loading" class="my-3 text-sm underline" @click="resend">{{ loading ? tr('ErrorFeedbackForm.dang_gui') : tr('SignUpView.gui_lai_email_xac_nhan') }}</button>
        <div v-if="resent">{{ tr('SignUpView.da_gui_lai_email_xac_nhan') }}</div>
        <div v-if="errorMessage" role="alert" class="text-red-700">{{ errorMessage }}</div>
        <div class="mb-2 font-serif text-[22px] text-[#18312d]">{{ tr('SignUpView.kiem_tra_email_cua_ban') }}</div>
        <div class="mb-[18px]">{{ tr('SignUpView.chung_toi_da_gui_lien_ket_xac_nhan_den') }} <strong class="text-[#18312d]">{{ form.email }}</strong>{{ tr('SignUpView.hay_xac_nhan_dia_chi_email_de_hoan_tat_dang_ky') }}</div>
        <RouterLink class="font-bold text-[#346457] underline decoration-transparent underline-offset-4 transition hover:decoration-current" to="/login">{{ tr('SignUpView.quay_lai_dang_nhap') }}</RouterLink>
      </div>

      <form v-else class="grid gap-[18px]" @submit.prevent="submit">
        <label class="grid gap-[7px] text-sm font-bold">
          <span>Email</span>
          <input v-model.trim="form.email" class="min-h-[46px] w-full rounded border border-[#9eb3aa] bg-white px-3 py-[10px] font-normal outline-none transition focus:border-[#346457] focus:ring-[3px] focus:ring-[#346457]/20" type="email" autocomplete="email" required placeholder="...@gmail.com" />
        </label>
        <label class="grid gap-[7px] text-sm font-bold">
          <span>{{ tr('LoginView.mat_khau') }}</span>
          <div class="relative">
            <input v-model="form.password" class="min-h-[46px] w-full rounded border border-[#9eb3aa] bg-white py-[10px] pl-3 pr-14 font-normal outline-none transition focus:border-[#346457] focus:ring-[3px] focus:ring-[#346457]/20" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" minlength="6" required :placeholder="tr('SignUpView.it_nhat_6_ky_tu')" />
            <button class="absolute inset-y-0 right-0 px-3 text-xs font-bold text-[#346457]" type="button" :aria-label="showPassword ? tr('LoginView.an_mat_khau') : tr('LoginView.hien_mat_khau')" @click="showPassword = !showPassword">{{ showPassword ? tr('FishingBag.an') : tr('LoginView.hien') }}</button>
          </div>
        </label>
        <label class="grid gap-[7px] text-sm font-bold">
          <span>{{ tr('SignUpView.nhap_lai_mat_khau') }}</span>
          <input v-model="form.confirmPassword" class="min-h-[46px] w-full rounded border border-[#9eb3aa] bg-white px-3 py-[10px] font-normal outline-none transition focus:border-[#346457] focus:ring-[3px] focus:ring-[#346457]/20" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required :placeholder="tr('SignUpView.nhap_lai_mat_khau')" />
        </label>
        <div v-if="errorMessage" class="-mt-1 text-[13px] leading-relaxed text-[#b52d26]" role="alert">{{ errorMessage }}</div>
        <button class="min-h-12 rounded bg-[#346457] font-bold text-white transition-colors hover:bg-[#254b40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#346457] disabled:cursor-wait disabled:opacity-70" type="submit" :disabled="loading">
          {{ loading ? tr('SignUpView.dang_tao_tai_khoan') : tr('LoginView.dang_ky') }}
        </button>
      </form>

      <div v-if="!confirmationSent" class="mt-6 text-center text-sm text-[#61716d]">{{ tr('SignUpView.da_co_tai_khoan') }}
        <RouterLink class="font-bold text-[#346457] underline decoration-transparent underline-offset-4 transition hover:decoration-current" to="/login">{{ tr('LoginView.dang_nhap') }}</RouterLink>
      </div>
    </section>
  </main>
</template>
