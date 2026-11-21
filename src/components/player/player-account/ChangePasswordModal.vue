<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { ref } from "vue";
import { useAuthStore } from "../../../stores/auth.ts";
import { useToast } from "../../../composables/useToast";

const emit = defineEmits<{ close: [] }>();
const authStore = useAuthStore();
const toast = useToast();
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const passwordError = ref("");

function close() {
  if (!authStore.passwordBusy) emit("close");
}

async function changePassword() {
  if (authStore.passwordBusy) return;
  passwordError.value = "";
  try {
    if (!currentPassword.value) throw new Error(tr('ChangePasswordModal.vui_long_nhap_mat_khau_hien_tai'));
    await authStore.updatePassword(newPassword.value, confirmPassword.value, currentPassword.value);
    currentPassword.value = newPassword.value = confirmPassword.value = "";
    toast.success(tr('ChangePasswordModal.da_doi_mat_khau'));
    emit("close");
  } catch (err) {
    passwordError.value = err instanceof Error ? err.message : tr('ChangePasswordModal.khong_the_doi_mat_khau');
    toast.error(passwordError.value);
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[10000] flex items-center justify-center bg-content/40 p-4 backdrop-blur-sm" @click.self="close" @keydown.esc.stop="close">
    <section
      class="player-popup-in max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-default bg-surface p-5 text-sm text-content shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <div id="change-password-title" class="text-lg font-bold text-content">{{ tr('ChangePasswordModal.doi_mat_khau') }}</div>
        <button type="button" :aria-label="tr('ChangePasswordModal.dong')" class="rounded-lg border border-border-default bg-white px-2 py-1 text-xl text-content transition-colors hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50" :disabled="authStore.passwordBusy" @click="close">×</button>
      </div>
      <form class="space-y-3" @submit.prevent="changePassword">
        <fieldset :disabled="authStore.passwordBusy" class="space-y-3">
          <label class="block font-medium">{{ tr('ChangePasswordModal.mat_khau_hien_tai') }}<input v-model="currentPassword" required type="password" autocomplete="current-password" class="mt-1 min-h-[46px] w-full rounded-xl border border-border-default bg-white px-3 py-2 font-normal text-content outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/20 disabled:bg-primary disabled:text-content/60" /></label>
          <label class="block font-medium">{{ tr('ChangePasswordModal.mat_khau_moi') }}<input v-model="newPassword" required minlength="8" type="password" autocomplete="new-password" class="mt-1 min-h-[46px] w-full rounded-xl border border-border-default bg-white px-3 py-2 font-normal text-content outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/20 disabled:bg-primary disabled:text-content/60" /></label>
          <label class="block font-medium">{{ tr('ChangePasswordModal.xac_nhan_mat_khau_moi') }}<input v-model="confirmPassword" required minlength="8" type="password" autocomplete="new-password" class="mt-1 min-h-[46px] w-full rounded-xl border border-border-default bg-white px-3 py-2 font-normal text-content outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/20 disabled:bg-primary disabled:text-content/60" /></label>
        </fieldset>
        <div v-if="passwordError" role="alert" class="text-danger">{{ passwordError }}</div>
        <div class="flex justify-end gap-2">
          <button type="button" :disabled="authStore.passwordBusy" class="min-h-11 rounded-xl border border-border-default bg-white px-4 py-2 font-bold text-content transition-colors hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50" @click="close">{{ tr('ChangePasswordModal.dong') }}</button>
          <button type="submit" :disabled="authStore.passwordBusy" class="min-h-11 rounded-xl border border-gold bg-gold px-4 py-2 font-bold text-content shadow-sm transition-colors hover:bg-gold/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-50">{{ authStore.passwordBusy ? tr('ChangePasswordModal.dang_luu') : tr('ChangePasswordModal.doi_mat_khau') }}</button>
        </div>
      </form>
    </section>
  </div>
</template>
