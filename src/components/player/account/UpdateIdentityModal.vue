<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
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
const localPreviewUrl = ref("");
const previewFailed = ref(false);
const removedAvatar = ref<{ url: string; file?: File }>();
const previewUrl = computed(() => localPreviewUrl.value || avatarUrl.value.trim());
const userInitial = computed(() => Array.from(displayName.value.trim())[0]?.toUpperCase() || "?");

function clearSelectedFile() {
  if (localPreviewUrl.value) URL.revokeObjectURL(localPreviewUrl.value);
  localPreviewUrl.value = "";
  avatarFile.value = undefined;
  if (avatarInput.value) avatarInput.value.value = "";
}

function selectAvatar(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  clearSelectedFile();
  avatarFile.value = file;
  localPreviewUrl.value = URL.createObjectURL(file);
}

function removeAvatar() {
  const previousAvatar = { url: avatarUrl.value, file: avatarFile.value };
  clearSelectedFile();
  avatarUrl.value = "";
  removedAvatar.value = previousAvatar;
}

function restoreAvatar() {
  const previousAvatar = removedAvatar.value;
  if (!previousAvatar) return;
  clearSelectedFile();
  avatarUrl.value = previousAvatar.url;
  avatarFile.value = previousAvatar.file;
  if (previousAvatar.file) localPreviewUrl.value = URL.createObjectURL(previousAvatar.file);
  removedAvatar.value = undefined;
}

watch([avatarUrl, avatarFile], () => { removedAvatar.value = undefined; }, { flush: "sync" });
watch(previewUrl, () => { previewFailed.value = false; });
watch([displayName, avatarUrl, avatarFile], () => {
  identitySaved.value = false;
  identityError.value = "";
}, { flush: "sync" });
onBeforeUnmount(clearSelectedFile);

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
    clearSelectedFile();
    removedAvatar.value = undefined;
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
      class="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] text-sm text-[#24352a] shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-identity-title"
    >
      <div class="flex items-start justify-between gap-3 border-b border-[#cbd9c6] px-5 py-4">
        <div>
          <div id="update-identity-title" class="text-lg font-bold">Tên và ảnh đại diện</div>
          <div class="mt-1 text-xs text-[#52654f]">Cập nhật cách bạn xuất hiện trong trò chơi.</div>
        </div>
        <button type="button" aria-label="Đóng" class="flex size-8 shrink-0 items-center justify-center rounded-full text-2xl transition hover:bg-[#cbd9c6]/40 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" :disabled="identityBusy" @click="close">&times;</button>
      </div>
      <form @submit.prevent="saveIdentity">
        <fieldset :disabled="identityBusy" class="min-w-0 space-y-5 p-5 disabled:opacity-60">
          <div>
            <div class="mb-3 font-semibold">Ảnh đại diện</div>
            <div class="flex items-center gap-4 rounded-xl border border-[#cbd9c6] bg-white p-4">
              <div class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#cbd9c6] bg-[#e7ecda] text-3xl font-bold">
                <img v-if="previewUrl && !previewFailed" :key="previewUrl" :src="previewUrl" alt="Xem trước ảnh đại diện" class="size-full object-cover" referrerpolicy="no-referrer" @error="previewFailed = true" />
                <span v-else aria-label="Chữ cái đại diện">{{ userInitial }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <input id="identity-avatar-file" ref="avatarInput" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" tabindex="-1" aria-label="Chọn ảnh đại diện từ thiết bị" @change="selectAvatar" />
                <button type="button" class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 font-semibold transition hover:bg-[#e7ecda] focus-visible:outline-2 focus-visible:outline-offset-2" @click="avatarInput?.click()">{{ avatarFile ? 'Đổi ảnh' : 'Chọn ảnh' }}</button>
                <div class="mt-2 text-xs leading-relaxed text-[#52654f]">JPG, PNG, WebP · tối đa 2 MB</div>
                <div v-if="avatarFile" class="mt-1 truncate text-xs text-[#52654f]" :title="avatarFile.name">{{ avatarFile.name }}</div>
              </div>
            </div>
            <div v-if="previewFailed" role="status" class="mt-2 text-xs text-amber-800">Không thể xem trước ảnh. Vui lòng chọn ảnh khác hoặc kiểm tra đường dẫn.</div>
            <div v-if="previewUrl || removedAvatar" class="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              <button v-if="avatarFile" type="button" class="rounded text-xs font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2" @click="clearSelectedFile">Bỏ ảnh vừa chọn</button>
              <button v-if="previewUrl" type="button" class="rounded text-xs font-medium text-[#52654f] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2" @click="removeAvatar">Dùng chữ cái đại diện</button>
              <button v-if="removedAvatar" type="button" class="rounded text-xs font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2" @click="restoreAvatar">Khôi phục ảnh trước đó</button>
            </div>
          </div>
          <div>
            <label for="identity-display-name" class="font-semibold">Tên hiển thị</label>
            <input id="identity-display-name" v-model.trim="displayName" required minlength="2" maxlength="40" aria-describedby="identity-name-hint" class="mt-2 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2.5 focus:border-[#52654f] focus:outline-2 focus:outline-[#cbd9c6]" />
            <div id="identity-name-hint" class="mt-1.5 text-xs text-[#52654f]">Từ 2 đến 40 ký tự.</div>
          </div>
          <details class="rounded-xl border border-[#cbd9c6] bg-white px-4 py-3">
            <summary class="cursor-pointer font-medium">Dùng đường dẫn ảnh</summary>
            <div class="mt-3">
              <label for="identity-avatar-url" class="text-xs text-[#52654f]">Đường dẫn ảnh (HTTPS)</label>
              <input id="identity-avatar-url" v-model.trim="avatarUrl" type="url" :disabled="!!avatarFile" placeholder="https://…" aria-describedby="identity-url-hint" class="mt-1.5 w-full rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2.5 focus:outline-2 focus:outline-[#cbd9c6] disabled:opacity-50" />
              <div id="identity-url-hint" class="mt-2 text-xs leading-relaxed text-[#52654f]">{{ avatarFile ? 'Bỏ ảnh vừa chọn để dùng đường dẫn ảnh.' : 'Để trống để dùng chữ cái đại diện.' }}</div>
            </div>
          </details>
        </fieldset>
        <div v-if="identityError" role="alert" class="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{{ identityError }}</div>
        <div v-if="identitySaved" role="status" class="mx-5 mb-4 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-emerald-800">Đã lưu hồ sơ.</div>
        <div class="flex justify-end gap-3 border-t border-[#cbd9c6] px-5 py-4">
          <button type="button" :disabled="identityBusy" class="rounded-lg border border-[#cbd9c6] px-4 py-2.5 font-medium transition hover:bg-[#e7ecda] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" @click="close">Đóng</button>
          <button type="submit" :disabled="identityBusy" class="rounded-lg bg-[#24352a] px-4 py-2.5 font-semibold text-white transition hover:bg-[#364c3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a] disabled:opacity-50">{{ identityBusy ? 'Đang lưu…' : 'Lưu hồ sơ' }}</button>
        </div>
      </form>
    </section>
  </div>
</template>
