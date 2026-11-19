<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { onMounted, ref } from "vue";
import { useAuthStore } from "../../../stores/auth.ts";
import { useUserProfileStore } from "../../../stores/userProfile.ts";
import Modal from "../../shared/Modal.vue";
import UserProfile from "./UserProfile.vue";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const userProfileStore = useUserProfileStore();
const router = useRouter();
const showSignOutConfirm = ref(false);
const isSigningOut = ref(false);
const signOutError = ref("");

function loadProfile() {
  const userId = authStore.user?.id;
  if (!userId) return;

  userProfileStore.fetchProfile(userId);
}

onMounted(loadProfile);

async function signOut() {
  if (isSigningOut.value) return;

  isSigningOut.value = true;
  signOutError.value = "";
  try {
    const succeeded = await authStore.signOut();
    if (succeeded) {
      showSignOutConfirm.value = false;
    } else {
      signOutError.value = authStore.error || tr('AccountInfoModal.khong_the_dang_xuat_vui_long_thu_lai');
    }
  } catch (error) {
    console.error("Lỗi khi đăng xuất:", error);
    signOutError.value = tr('AccountInfoModal.khong_the_dang_xuat_vui_long_thu_lai');
  } finally {
    isSigningOut.value = false;
    router.replace("login");
  }
}
</script>

<template>
  <Modal :title="tr('AccountInfoModal.thong_tin_tai_khoan')" :on-refresh="loadProfile">
    <div>
      <div
        v-if="userProfileStore.loading && !userProfileStore.profile"
        class="flex flex-col items-center justify-center py-10 gap-3"
      >
        <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs text-gray-500 font-medium">{{ tr('AccountInfoModal.dang_tai_ho_so') }}</span>
      </div>

      <div v-else-if="userProfileStore.error && !userProfileStore.profile" class="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
        <div class="flex items-center justify-between">
          <span class="text-xs text-red-600 font-medium">{{ userProfileStore.error }}</span>
          <button
            type="button"
            class="text-xs font-semibold text-red-700 underline hover:no-underline cursor-pointer"
            @click="loadProfile"
          >
            {{ tr('Maintenance.thu_lai') }}
          </button>
        </div>
      </div>

      <UserProfile
        v-else
        @sign-out="
          showSignOutConfirm = true;
          signOutError = '';
        "
      />
    </div>
  </Modal>

  <Teleport to="body">
    <div
      v-if="showSignOutConfirm"
      class="fixed z-[10000] inset-0 grid place-items-center p-5 bg-black/60 backdrop-blur-sm"
      role="presentation"
      @click.self="!isSigningOut && (showSignOutConfirm = false)"
    >
      <section
        class="player-popup-in w-[min(380px,100%)] rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-out-title"
      >
        <div id="sign-out-title" class="m-0 text-lg font-bold text-[#263238]">{{ tr('AccountInfoModal.xac_nhan_dang_xuat') }}</div>
        <div class="my-3 text-sm leading-relaxed text-gray-600">
          {{ tr('AccountInfoModal.ban_co_chac_chan_muon_dang_xuat_khoi_tai_khoan_nay_khong') }}
        </div>
        <div v-if="signOutError" role="alert" class="mb-3 text-sm font-medium text-red-700">
          {{ signOutError }}
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isSigningOut"
            @click="showSignOutConfirm = false"
          >
            {{ tr('AccountInfoModal.huy') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isSigningOut"
            @click="signOut"
          >
            {{ isSigningOut ? tr('AccountInfoModal.dang_dang_xuat') : tr('AccountInfoModal.dang_xuat') }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
