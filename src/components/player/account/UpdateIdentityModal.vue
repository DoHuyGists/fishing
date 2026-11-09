<script lang="ts" setup>
import { ref } from "vue";
import { useUserProfileStore } from "../../../stores/userProfile.ts";

const emit = defineEmits<{ close: [] }>();
const userProfileStore = useUserProfileStore();
const displayName = ref(userProfileStore.profile?.display_name ?? "");
const avatarUrl = ref(userProfileStore.profile?.avatar_url ?? "");
const avatarFile = ref<File>();
const avatarInput = ref<HTMLInputElement>();
const identityBusy = ref(false);
const identityError = ref("");
const identitySaved = ref(false);

function close() {
  if (!identityBusy.value) emit("close");
}

async function saveIdentity() {
  if (identityBusy.value) return;
  identityBusy.value = true;
  identityError.value = "";
  identitySaved.value = false;
  try {
    await userProfileStore.updateIdentity(displayName.value, avatarUrl.value.trim() || null, avatarFile.value);
    avatarUrl.value = userProfileStore.profile?.avatar_url ?? "";
    avatarFile.value = undefined;
    if (avatarInput.value) avatarInput.value.value = "";
    identitySaved.value = true;
  } catch (err) {
    identityError.value = err instanceof Error ? err.message : "Không thể lưu hồ sơ.";
  } finally {
    identityBusy.value = false;
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" @click.self="close" @keydown.esc.stop="close">
    <section
      class="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-5 text-sm text-[#24352a] shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-identity-title"
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 id="update-identity-title" class="text-lg font-bold">Tên và ảnh đại diện</h2>
        <button type="button" aria-label="Đóng" class="rounded px-2 py-1 text-xl disabled:opacity-50" :disabled="identityBusy" @click="close">&times;</button>
      </div>
      <form class="space-y-3" @submit.prevent="saveIdentity">
        <fieldset :disabled="identityBusy" class="space-y-3">
          <label class="block">Tên hiển thị<input v-model.trim="displayName" required minlength="2" maxlength="40" class="mt-1 w-full rounded border border-[#cbd9c6] bg-white p-2" /></label>
          <label class="block">Đường dẫn ảnh đại diện (HTTPS)<input v-model.trim="avatarUrl" type="url" placeholder="https://…" class="mt-1 w-full rounded border border-[#cbd9c6] bg-white p-2" /></label>
          <label class="block">Hoặc tải ảnh từ thiết bị (JPG, PNG, WebP · tối đa 2 MB)<input ref="avatarInput" type="file" accept="image/jpeg,image/png,image/webp" class="mt-1 block w-full" @change="avatarFile = ($event.target as HTMLInputElement).files?.[0]" /></label>
        </fieldset>
        <p class="text-xs text-gray-600">Ảnh tải từ thiết bị được ưu tiên. Để trống đường dẫn và không chọn file để dùng chữ cái đại diện.</p>
        <p v-if="identityError" role="alert" class="text-red-700">{{ identityError }}</p>
        <p v-if="identitySaved" role="status">Đã lưu hồ sơ.</p>
        <div class="flex justify-end gap-2">
          <button type="button" :disabled="identityBusy" class="rounded border border-[#cbd9c6] px-4 py-2 disabled:opacity-50" @click="close">Đóng</button>
          <button type="submit" :disabled="identityBusy" class="rounded bg-[#24352a] px-4 py-2 text-white disabled:opacity-50">{{ identityBusy ? 'Đang lưu…' : 'Lưu hồ sơ' }}</button>
        </div>
      </form>
    </section>
  </div>
</template>
