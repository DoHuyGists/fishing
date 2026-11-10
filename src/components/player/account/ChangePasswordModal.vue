<script lang="ts" setup>
import { ref } from "vue";
import { useAuthStore } from "../../../stores/auth.ts";

const emit = defineEmits<{ close: [] }>();
const authStore = useAuthStore();
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const passwordError = ref("");
const passwordSaved = ref(false);

function close() {
  if (!authStore.passwordBusy) emit("close");
}

async function changePassword() {
  if (authStore.passwordBusy) return;
  passwordError.value = "";
  passwordSaved.value = false;
  try {
    if (!currentPassword.value) throw new Error("Vui lòng nhập mật khẩu hiện tại.");
    await authStore.updatePassword(newPassword.value, confirmPassword.value, currentPassword.value);
    currentPassword.value = newPassword.value = confirmPassword.value = "";
    passwordSaved.value = true;
  } catch (err) {
    passwordError.value = err instanceof Error ? err.message : "Không thể đổi mật khẩu.";
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" @click.self="close" @keydown.esc.stop="close">
    <section
      class="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-5 text-sm text-[#24352a] shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <div id="change-password-title" class="text-lg font-bold">Đổi mật khẩu</div>
        <button type="button" aria-label="Đóng" class="rounded px-2 py-1 text-xl disabled:opacity-50" :disabled="authStore.passwordBusy" @click="close">&times;</button>
      </div>
      <form class="space-y-3" @submit.prevent="changePassword">
        <fieldset :disabled="authStore.passwordBusy" class="space-y-3">
          <label class="block">Mật khẩu hiện tại<input v-model="currentPassword" required type="password" autocomplete="current-password" class="mt-1 w-full rounded border border-[#cbd9c6] bg-white p-2" /></label>
          <label class="block">Mật khẩu mới<input v-model="newPassword" required minlength="8" type="password" autocomplete="new-password" class="mt-1 w-full rounded border border-[#cbd9c6] bg-white p-2" /></label>
          <label class="block">Xác nhận mật khẩu mới<input v-model="confirmPassword" required minlength="8" type="password" autocomplete="new-password" class="mt-1 w-full rounded border border-[#cbd9c6] bg-white p-2" /></label>
        </fieldset>
        <p v-if="passwordError" role="alert" class="text-red-700">{{ passwordError }}</p>
        <p v-if="passwordSaved" role="status">Đã đổi mật khẩu.</p>
        <div class="flex justify-end gap-2">
          <button type="button" :disabled="authStore.passwordBusy" class="rounded border border-[#cbd9c6] px-4 py-2 disabled:opacity-50" @click="close">Đóng</button>
          <button type="submit" :disabled="authStore.passwordBusy" class="rounded bg-[#24352a] px-4 py-2 text-white disabled:opacity-50">{{ authStore.passwordBusy ? 'Đang lưu…' : 'Đổi mật khẩu' }}</button>
        </div>
      </form>
    </section>
  </div>
</template>
