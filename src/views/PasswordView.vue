<script setup lang="ts">
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
      if (!auth.isAuthenticated) throw new Error("Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu email mới.");
      await auth.updatePassword(password.value, confirmation.value);
      password.value = confirmation.value = "";
    }
    success.value = true;
  } catch (err) { error.value = err instanceof Error ? err.message : "Không thể xử lý. Vui lòng thử lại."; }
}
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-[#f5f9f0] p-6 text-[#24352a]">
    <section class="w-full max-w-md space-y-5 rounded-xl border border-[#cbd9c6] bg-white p-6">
      <h1 class="text-2xl font-bold">{{ isRequest ? 'Quên mật khẩu' : 'Đặt lại mật khẩu' }}</h1>
      <p v-if="success" role="status">{{ isRequest ? 'Nếu email có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra cả thư rác.' : 'Đã cập nhật mật khẩu.' }}</p>
      <form v-else class="space-y-4" @submit.prevent="submit">
        <label v-if="isRequest" class="block">Email<input v-model.trim="email" type="email" autocomplete="email" required class="mt-1 w-full rounded border border-[#cbd9c6] p-3" /></label>
        <template v-else-if="auth.isAuthenticated">
          <label class="block">Mật khẩu mới<input v-model="password" type="password" autocomplete="new-password" minlength="8" required class="mt-1 w-full rounded border border-[#cbd9c6] p-3" /></label>
          <label class="block">Xác nhận mật khẩu<input v-model="confirmation" type="password" autocomplete="new-password" minlength="8" required class="mt-1 w-full rounded border border-[#cbd9c6] p-3" /></label>
        </template>
        <p v-else role="alert">Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu email mới.</p>
        <p v-if="error" role="alert" class="text-red-700">{{ error }}</p>
        <button v-if="isRequest || auth.isAuthenticated" :disabled="auth.passwordBusy || !auth.initialized" class="w-full rounded bg-[#24352a] p-3 text-white disabled:opacity-50">{{ auth.passwordBusy ? 'Đang xử lý…' : isRequest ? 'Gửi liên kết' : 'Lưu mật khẩu' }}</button>
      </form>
      <nav class="flex justify-between gap-3 text-sm underline"><RouterLink to="/forgot-password">Yêu cầu email mới</RouterLink><RouterLink :to="auth.isAuthenticated ? '/' : '/login'">{{ auth.isAuthenticated ? 'Về game' : 'Đăng nhập' }}</RouterLink></nav>
    </section>
  </main>
</template>
