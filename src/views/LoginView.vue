<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

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
  <main class="login-page">
    <section class="login-panel" aria-labelledby="login-title">
      <div class="brand-mark" aria-hidden="true">C</div>
      <p class="eyebrow">Nhật ký mặt hồ</p>
      <h1 id="login-title">Vào hồ câu</h1>
      <p class="intro">Đăng nhập để tiếp tục hành trình của bạn.</p>

      <form class="login-form" @submit.prevent="submit">
        <label>
          <span>Email</span>
          <input v-model.trim="form.email" type="email" autocomplete="email" required placeholder="ban@example.com" />
        </label>
        <label>
          <span>Mật khẩu</span>
          <div class="password-field">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              placeholder="Nhập mật khẩu"
            />
            <button
              type="button"
              :aria-label="showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? "Ẩn" : "Hiện" }}
            </button>
          </div>
        </label>
        <p v-if="auth.error" class="login-error" role="alert">{{ auth.error }}</p>
        <button class="submit-button" type="submit" :disabled="auth.loading">
          {{ auth.loading ? "Đang đăng nhập..." : "Đăng nhập" }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  --ink: #18312d;
  --muted: #61716d;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  color: var(--ink);
  background-color: #dcebe4;
  background-image:
    linear-gradient(115deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px),
    linear-gradient(25deg, rgba(52, 100, 87, 0.08) 1px, transparent 1px);
  background-size:
    24px 24px,
    32px 32px;
}

.login-panel {
  width: min(100%, 408px);
  padding: 42px;
  border: 1px solid #b8cbc3;
  border-radius: 8px;
  background: #fffdf8;
  box-shadow: 12px 12px 0 #346457;
}

.brand-mark {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #e57a44;
  color: #fffdf8;
  font:
    700 22px Georgia,
    serif;
}
.eyebrow {
  margin: 28px 0 5px;
  color: #b9522c;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.login-panel h1 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 34px;
  line-height: 1.1;
}
.intro {
  margin: 10px 0 28px;
  color: var(--muted);
}
.login-form {
  display: grid;
  gap: 18px;
}
.login-form label {
  display: grid;
  gap: 7px;
  color: var(--ink);
  font-size: 14px;
  font-weight: 700;
}
.login-form input {
  width: 100%;
  box-sizing: border-box;
  min-height: 46px;
  border: 1px solid #9eb3aa;
  border-radius: 4px;
  padding: 10px 12px;
  color: var(--ink);
  background: #fff;
  font: inherit;
  font-weight: 400;
  outline: none;
}
.login-form input:focus {
  border-color: #346457;
  box-shadow: 0 0 0 3px rgba(52, 100, 87, 0.18);
}
.password-field {
  position: relative;
}
.password-field input {
  padding-right: 55px;
}
.password-field button {
  position: absolute;
  top: 0;
  right: 0;
  height: 46px;
  border: 0;
  padding: 0 12px;
  color: #346457;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}
.login-error {
  margin: -4px 0 0;
  color: #b52d26;
  font-size: 13px;
  line-height: 1.4;
}
.submit-button {
  min-height: 48px;
  border: 0;
  border-radius: 4px;
  background: #346457;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  transition: background 150ms ease;
}
.submit-button:hover:not(:disabled) {
  background: #254b40;
}
.submit-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

@media (max-width: 480px) {
  .login-panel {
    padding: 30px 24px;
    box-shadow: 7px 7px 0 #346457;
  }
}
</style>
