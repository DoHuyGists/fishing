<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import supabase from "../database/connection";

const router = useRouter();
const form = reactive({ email: "", password: "", confirmPassword: "" });
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref("");
const confirmationSent = ref(false);

async function submit() {
  errorMessage.value = "";

  if (form.password !== form.confirmPassword) {
    errorMessage.value = "Mật khẩu xác nhận không khớp.";
    return;
  }

  loading.value = true;
  try {
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
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
    errorMessage.value = "Không thể tạo tài khoản lúc này. Vui lòng thử lại.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-[#dcebe4] bg-[linear-gradient(115deg,rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(25deg,rgba(52,100,87,0.08)_1px,transparent_1px)] bg-size-[24px_24px,32px_32px] px-6 py-8 text-[#18312d]">
    <section class="w-full max-w-[408px] rounded-lg border border-[#b8cbc3] bg-[#fffdf8] p-8 shadow-[12px_12px_0_#346457] sm:p-[42px]" aria-labelledby="signup-title">
      <div class="grid size-[42px] place-items-center rounded-full bg-[#e57a44] font-serif text-[22px] font-bold text-[#fffdf8]" aria-hidden="true">F</div>
      <p class="mb-[5px] mt-7 text-xs font-bold uppercase tracking-[0.08em] text-[#b9522c]">Bắt đầu hành trình</p>
      <h1 id="signup-title" class="font-serif text-[34px] leading-tight">Tạo tài khoản</h1>
      <p class="mb-7 mt-2 text-[#61716d]">Đăng ký để cùng khám phá những chuyến câu mới.</p>

      <div v-if="confirmationSent" class="leading-relaxed text-[#61716d]" role="status">
        <h2 class="mb-2 font-serif text-[22px] text-[#18312d]">Kiểm tra email của bạn</h2>
        <p class="mb-[18px]">Chúng tôi đã gửi liên kết xác nhận đến <strong class="text-[#18312d]">{{ form.email }}</strong>. Hãy xác nhận địa chỉ email để hoàn tất đăng ký.</p>
        <RouterLink class="font-bold text-[#346457] underline decoration-transparent underline-offset-4 transition hover:decoration-current" to="/login">Quay lại đăng nhập</RouterLink>
      </div>

      <form v-else class="grid gap-[18px]" @submit.prevent="submit">
        <label class="grid gap-[7px] text-sm font-bold">
          <span>Email</span>
          <input v-model.trim="form.email" class="min-h-[46px] w-full rounded border border-[#9eb3aa] bg-white px-3 py-[10px] font-normal outline-none transition focus:border-[#346457] focus:ring-[3px] focus:ring-[#346457]/20" type="email" autocomplete="email" required placeholder="...@gmail.com" />
        </label>
        <label class="grid gap-[7px] text-sm font-bold">
          <span>Mật khẩu</span>
          <div class="relative">
            <input v-model="form.password" class="min-h-[46px] w-full rounded border border-[#9eb3aa] bg-white py-[10px] pl-3 pr-14 font-normal outline-none transition focus:border-[#346457] focus:ring-[3px] focus:ring-[#346457]/20" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" minlength="6" required placeholder="Ít nhất 6 ký tự" />
            <button class="absolute inset-y-0 right-0 px-3 text-xs font-bold text-[#346457]" type="button" :aria-label="showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'" @click="showPassword = !showPassword">{{ showPassword ? "Ẩn" : "Hiện" }}</button>
          </div>
        </label>
        <label class="grid gap-[7px] text-sm font-bold">
          <span>Nhập lại mật khẩu</span>
          <input v-model="form.confirmPassword" class="min-h-[46px] w-full rounded border border-[#9eb3aa] bg-white px-3 py-[10px] font-normal outline-none transition focus:border-[#346457] focus:ring-[3px] focus:ring-[#346457]/20" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required placeholder="Nhập lại mật khẩu" />
        </label>
        <p v-if="errorMessage" class="-mt-1 text-[13px] leading-relaxed text-[#b52d26]" role="alert">{{ errorMessage }}</p>
        <button class="min-h-12 rounded bg-[#346457] font-bold text-white transition-colors hover:bg-[#254b40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#346457] disabled:cursor-wait disabled:opacity-70" type="submit" :disabled="loading">
          {{ loading ? "Đang tạo tài khoản..." : "Đăng ký" }}
        </button>
      </form>

      <p v-if="!confirmationSent" class="mt-6 text-center text-sm text-[#61716d]">Đã có tài khoản?
        <RouterLink class="font-bold text-[#346457] underline decoration-transparent underline-offset-4 transition hover:decoration-current" to="/login">Đăng nhập</RouterLink>
      </p>
    </section>
  </main>
</template>
