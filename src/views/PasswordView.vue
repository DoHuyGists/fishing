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
  <main class="grid min-h-screen place-items-center bg-[var(--color-ocean-deep)] bg-[radial-gradient(ellipse_at_12%_0%,rgba(53,185,213,0.22),transparent_50%),radial-gradient(ellipse_at_100%_100%,rgba(29,84,117,0.8),transparent_55%)] p-6 text-[var(--color-ocean-pearl)]">
    <section class="player-popup-in w-full max-w-md space-y-5 rounded-3xl border border-[var(--color-ocean-gold)]/60 bg-[linear-gradient(145deg,var(--color-ocean-panel),var(--color-ocean-deep))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(245,235,212,0.12)]">
      <div class="text-2xl font-bold text-[var(--color-ocean-gold)]">{{ isRequest ? tr('PasswordView.quen_mat_khau') : tr('PasswordView.dat_lai_mat_khau') }}</div>
      <div v-if="success" role="status">{{ isRequest ? tr('PasswordView.neu_email_co_tai_khoan_ban_se_nhan_duoc_lien_ket_dat_lai_mat_kha') : tr('PasswordView.da_cap_nhat_mat_khau') }}</div>
      <form v-else class="space-y-4" @submit.prevent="submit">
        <label v-if="isRequest" class="block text-sm font-bold">Email<input v-model.trim="email" type="email" autocomplete="email" required class="mt-2 w-full rounded-xl border border-[var(--color-ocean-cyan)]/35 bg-[var(--color-ocean-deep)] p-3 font-normal text-[var(--color-ocean-pearl)] outline-none transition focus:border-[var(--color-ocean-cyan)] focus:ring-[3px] focus:ring-[var(--color-ocean-cyan)]/20" /></label>
        <template v-else-if="auth.isAuthenticated">
          <label class="block text-sm font-bold">{{ tr('ChangePasswordModal.mat_khau_moi') }}<input v-model="password" type="password" autocomplete="new-password" minlength="8" required class="mt-2 w-full rounded-xl border border-[var(--color-ocean-cyan)]/35 bg-[var(--color-ocean-deep)] p-3 font-normal text-[var(--color-ocean-pearl)] outline-none transition focus:border-[var(--color-ocean-cyan)] focus:ring-[3px] focus:ring-[var(--color-ocean-cyan)]/20" /></label>
          <label class="block text-sm font-bold">{{ tr('PasswordView.xac_nhan_mat_khau') }}<input v-model="confirmation" type="password" autocomplete="new-password" minlength="8" required class="mt-2 w-full rounded-xl border border-[var(--color-ocean-cyan)]/35 bg-[var(--color-ocean-deep)] p-3 font-normal text-[var(--color-ocean-pearl)] outline-none transition focus:border-[var(--color-ocean-cyan)] focus:ring-[3px] focus:ring-[var(--color-ocean-cyan)]/20" /></label>
        </template>
        <div v-else role="alert">{{ tr('PasswordView.lien_ket_khong_hop_le_hoac_da_het_han_vui_long_yeu_cau_email_moi') }}</div>
        <div v-if="error" role="alert" class="text-red-300">{{ error }}</div>
        <button v-if="isRequest || auth.isAuthenticated" :disabled="auth.passwordBusy || !auth.initialized" class="min-h-12 w-full rounded-xl border border-[var(--color-ocean-gold)] bg-[var(--color-ocean-gold)] p-3 font-bold text-[var(--color-ocean-deep)] shadow-[0_4px_0_rgba(147,100,63,0.75)] transition hover:brightness-110 active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ocean-cyan)] disabled:cursor-wait disabled:opacity-50">{{ auth.passwordBusy ? tr('InventoryModal.dang_xu_ly') : isRequest ? tr('PasswordView.gui_lien_ket') : tr('PasswordView.luu_mat_khau') }}</button>
      </form>
      <nav class="flex justify-between gap-3 text-sm text-[var(--color-ocean-cyan)] underline underline-offset-4"><RouterLink class="hover:text-[var(--color-ocean-gold)]" to="/forgot-password">{{ tr('PasswordView.yeu_cau_email_moi') }}</RouterLink><RouterLink class="hover:text-[var(--color-ocean-gold)]" :to="auth.isAuthenticated ? '/' : '/login'">{{ auth.isAuthenticated ? tr('PasswordView.ve_game') : tr('LoginView.dang_nhap') }}</RouterLink></nav>
    </section>
  </main>
</template>
