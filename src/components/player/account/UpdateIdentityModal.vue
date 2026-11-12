<script lang="ts" setup>
import { t as tr } from "../../../i18n";

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
    identityError.value = err instanceof Error ? err.message : tr('UpdateIdentityModal.khong_the_luu_ho_so');
  } finally {
    identityBusy.value = false;
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" @click.self="close" @keydown.esc.stop="close">
    <section
      class="player-popup-in max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] text-sm text-[#24352a] shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-identity-title"
    >
      <div class="flex items-start justify-between gap-3 border-b border-[#cbd9c6] px-5 py-4">
        <div>
          <div id="update-identity-title" class="text-lg font-bold">{{ tr('UpdateIdentityModal.ten_va_anh_dai_dien') }}</div>
          <div class="mt-1 text-xs text-[#52654f]">{{ tr('UpdateIdentityModal.cap_nhat_cach_ban_xuat_hien_trong_tro_choi') }}</div>
        </div>
        <button type="button" :aria-label="tr('ChangePasswordModal.dong')" class="flex size-8 shrink-0 items-center justify-center rounded-full text-2xl transition hover:bg-[#cbd9c6]/40 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" :disabled="identityBusy" @click="close">×</button>
      </div>
      <form @submit.prevent="saveIdentity">
        <fieldset :disabled="identityBusy" class="min-w-0 space-y-5 p-5 disabled:opacity-60">
          <div>
            <div class="mb-3 font-semibold">{{ tr('UpdateIdentityModal.anh_dai_dien') }}</div>
            <div class="flex items-center gap-4 rounded-xl border border-[#cbd9c6] bg-white p-4">
              <div class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#cbd9c6] bg-[#e7ecda] text-3xl font-bold">
                <img v-if="previewUrl && !previewFailed" :key="previewUrl" :src="previewUrl" :alt="tr('UpdateIdentityModal.xem_truoc_anh_dai_dien')" class="size-full object-cover" referrerpolicy="no-referrer" @error="previewFailed = true" />
                <span v-else :aria-label="tr('UpdateIdentityModal.chu_cai_dai_dien')">{{ userInitial }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <input id="identity-avatar-file" ref="avatarInput" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" tabindex="-1" :aria-label="tr('UpdateIdentityModal.chon_anh_dai_dien_tu_thiet_bi')" @change="selectAvatar" />
                <button type="button" class="rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2 font-semibold transition hover:bg-[#e7ecda] focus-visible:outline-2 focus-visible:outline-offset-2" @click="avatarInput?.click()">{{ avatarFile ? tr('UpdateIdentityModal.doi_anh') : tr('UpdateIdentityModal.chon_anh') }}</button>
                <div class="mt-2 text-xs leading-relaxed text-[#52654f]">{{ tr('UpdateIdentityModal.jpg_png_webp_toi_da_2_mb') }}</div>
                <div v-if="avatarFile" class="mt-1 truncate text-xs text-[#52654f]" :title="avatarFile.name">{{ avatarFile.name }}</div>
              </div>
            </div>
            <div v-if="previewFailed" role="status" class="mt-2 text-xs text-amber-800">{{ tr('UpdateIdentityModal.khong_the_xem_truoc_anh_vui_long_chon_anh_khac_hoac_kiem_tra_duo') }}</div>
            <div v-if="previewUrl || removedAvatar" class="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              <button v-if="avatarFile" type="button" class="rounded text-xs font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2" @click="clearSelectedFile">{{ tr('UpdateIdentityModal.bo_anh_vua_chon') }}</button>
              <button v-if="previewUrl" type="button" class="rounded text-xs font-medium text-[#52654f] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2" @click="removeAvatar">{{ tr('UpdateIdentityModal.dung_chu_cai_dai_dien') }}</button>
              <button v-if="removedAvatar" type="button" class="rounded text-xs font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2" @click="restoreAvatar">{{ tr('UpdateIdentityModal.khoi_phuc_anh_truoc_do') }}</button>
            </div>
          </div>
          <div>
            <label for="identity-display-name" class="font-semibold">{{ tr('UpdateIdentityModal.ten_hien_thi') }}</label>
            <input id="identity-display-name" v-model.trim="displayName" required minlength="2" maxlength="40" aria-describedby="identity-name-hint" class="mt-2 w-full rounded-lg border border-[#cbd9c6] bg-white px-3 py-2.5 focus:border-[#52654f] focus:outline-2 focus:outline-[#cbd9c6]" />
            <div id="identity-name-hint" class="mt-1.5 text-xs text-[#52654f]">{{ tr('UpdateIdentityModal.tu_2_den_40_ky_tu') }}</div>
          </div>
          <details class="rounded-xl border border-[#cbd9c6] bg-white px-4 py-3">
            <summary class="cursor-pointer font-medium">{{ tr('UpdateIdentityModal.dung_duong_dan_anh') }}</summary>
            <div class="mt-3">
              <label for="identity-avatar-url" class="text-xs text-[#52654f]">{{ tr('UpdateIdentityModal.duong_dan_anh_https') }}</label>
              <input id="identity-avatar-url" v-model.trim="avatarUrl" type="url" :disabled="!!avatarFile" placeholder="https://…" aria-describedby="identity-url-hint" class="mt-1.5 w-full rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-2.5 focus:outline-2 focus:outline-[#cbd9c6] disabled:opacity-50" />
              <div id="identity-url-hint" class="mt-2 text-xs leading-relaxed text-[#52654f]">{{ avatarFile ? tr('UpdateIdentityModal.bo_anh_vua_chon_de_dung_duong_dan_anh') : tr('UpdateIdentityModal.de_trong_de_dung_chu_cai_dai_dien') }}</div>
            </div>
          </details>
        </fieldset>
        <div v-if="identityError" role="alert" class="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{{ identityError }}</div>
        <div v-if="identitySaved" role="status" class="mx-5 mb-4 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-emerald-800">{{ tr('UpdateIdentityModal.da_luu_ho_so') }}</div>
        <div class="flex justify-end gap-3 border-t border-[#cbd9c6] px-5 py-4">
          <button type="button" :disabled="identityBusy" class="rounded-lg border border-[#cbd9c6] px-4 py-2.5 font-medium transition hover:bg-[#e7ecda] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" @click="close">{{ tr('ChangePasswordModal.dong') }}</button>
          <button type="submit" :disabled="identityBusy" class="rounded-lg bg-[#24352a] px-4 py-2.5 font-semibold text-white transition hover:bg-[#364c3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a] disabled:opacity-50">{{ identityBusy ? tr('ChangePasswordModal.dang_luu') : tr('UpdateIdentityModal.luu_ho_so') }}</button>
        </div>
      </form>
    </section>
  </div>
</template>
