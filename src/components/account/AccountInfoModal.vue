<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useAuthStore } from "../../stores/auth";
import { useUserProfileStore } from "../../stores/userProfile";
import { useBadgesStore } from "../../stores/badges";
import Modal from "../shared/Modal.vue";
import Achievement from "./Achievement.vue";
import UserProfile from "./UserProfile.vue";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const userProfileStore = useUserProfileStore();
const badgesStore = useBadgesStore();
const router = useRouter();
const showSignOutConfirm = ref(false);
const isSigningOut = ref(false);
const signOutError = ref("");

function loadProfile() {
  const userId = authStore.user?.id;
  if (!userId) return;

  userProfileStore.fetchProfile(userId);
  badgesStore.fetchForUser(userId, true);
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
      signOutError.value = authStore.error || "Không thể đăng xuất. Vui lòng thử lại.";
    }
  } catch (error) {
    console.error("Lỗi khi đăng xuất:", error);
    signOutError.value = "Không thể đăng xuất. Vui lòng thử lại.";
  } finally {
    isSigningOut.value = false;
    router.replace("login");
  }
}
</script>

<template>
  <Modal title="Thông tin tài khoản" :on-refresh="loadProfile">
    <div>
      <div
        v-if="userProfileStore.loading && !userProfileStore.profile"
        class="flex flex-col items-center justify-center py-10 gap-3"
      >
        <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs text-gray-500 font-medium">Đang tải hồ sơ...</span>
      </div>

      <div v-else-if="userProfileStore.error" class="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
        <div class="flex items-center justify-between">
          <span class="text-xs text-red-600 font-medium">{{ userProfileStore.error }}</span>
          <button
            type="button"
            class="text-xs font-semibold text-red-700 underline hover:no-underline cursor-pointer"
            @click="loadProfile"
          >
            Thử lại
          </button>
        </div>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2">
        <UserProfile @sign-out="showSignOutConfirm = true; signOutError = ''" />
        <Achievement />
      </div>
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
        class="w-[min(380px,100%)] rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-out-title"
      >
        <h2 id="sign-out-title" class="m-0 text-lg font-bold text-[#263238]">Xác nhận đăng xuất</h2>
        <p class="my-3 text-sm leading-relaxed text-gray-600">
          Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này không?
        </p>
        <p v-if="signOutError" role="alert" class="mb-3 text-sm font-medium text-red-700">
          {{ signOutError }}
        </p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isSigningOut"
            @click="showSignOutConfirm = false"
          >
            Hủy
          </button>
          <button
            type="button"
            class="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isSigningOut"
            @click="signOut"
          >
            {{ isSigningOut ? "Đang đăng xuất..." : "Đăng xuất" }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
