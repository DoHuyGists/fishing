<script setup lang="ts">
import { t as tr } from "../i18n";

import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const auth = useAuthStore();
const isRequest = computed(() => route.name === "forgotPassword");
const email = ref("");
const password = ref("");
const confirmation = ref("");
const error = ref("");
const success = ref(false);
async function submit() {
  error.value = "";
  try {
    if (isRequest.value) await auth.requestPasswordReset(email.value);
    else {
      if (!auth.isAuthenticated) throw new Error(tr('PasswordView.lien_ket_khong_hop_le_hoac_da_het_han_hay_yeu_cau_email_moi'));
      await auth.updatePassword(password.value, confirmation.value);
      password.value = confirmation.value = "";
    }
    success.value = true;
  } catch (err) { error.value = err instanceof Error ? err.message : tr('PasswordView.khong_the_xu_ly_vui_long_thu_lai'); }
}
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-[#f5f9f0] p-6 text-[#24352a]">
    <section class="w-full max-w-md space-y-5 rounded-xl border border-[#cbd9c6] bg-white p-6">
      <div class="text-2xl font-bold">{{ isRequest ? tr('PasswordView.quen_mat_khau') : tr('PasswordView.dat_lai_mat_khau') }}</div>
      <div v-if="success" role="status">{{ isRequest ? tr('PasswordView.neu_email_co_tai_khoan_ban_se_nhan_duoc_lien_ket_dat_lai_mat_kha') : tr('PasswordView.da_cap_nhat_mat_khau') }}</div>
      <form v-else class="space-y-4" @submit.prevent="submit">
        <label v-if="isRequest" class="block">Email<input v-model.trim="email" type="email" autocomplete="email" required class="mt-1 w-full rounded border border-[#cbd9c6] p-3" /></label>
        <template v-else-if="auth.isAuthenticated">
          <label class="block">{{ tr('ChangePasswordModal.mat_khau_moi') }}<input v-model="password" type="password" autocomplete="new-password" minlength="8" required class="mt-1 w-full rounded border border-[#cbd9c6] p-3" /></label>
          <label class="block">{{ tr('PasswordView.xac_nhan_mat_khau') }}<input v-model="confirmation" type="password" autocomplete="new-password" minlength="8" required class="mt-1 w-full rounded border border-[#cbd9c6] p-3" /></label>
        </template>
        <div v-else role="alert">{{ tr('PasswordView.lien_ket_khong_hop_le_hoac_da_het_han_vui_long_yeu_cau_email_moi') }}</div>
        <div v-if="error" role="alert" class="text-red-700">{{ error }}</div>
        <button v-if="isRequest || auth.isAuthenticated" :disabled="auth.passwordBusy || !auth.initialized" class="w-full rounded bg-[#24352a] p-3 text-white disabled:opacity-50">{{ auth.passwordBusy ? tr('InventoryModal.dang_xu_ly') : isRequest ? tr('PasswordView.gui_lien_ket') : tr('PasswordView.luu_mat_khau') }}</button>
      </form>
      <nav class="flex justify-between gap-3 text-sm underline"><RouterLink to="/forgot-password">{{ tr('PasswordView.yeu_cau_email_moi') }}</RouterLink><RouterLink :to="auth.isAuthenticated ? '/' : '/login'">{{ auth.isAuthenticated ? tr('PasswordView.ve_game') : tr('LoginView.dang_nhap') }}</RouterLink></nav>
    </section>
  </main>
</template>
