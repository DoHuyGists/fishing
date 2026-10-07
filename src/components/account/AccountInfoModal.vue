<script lang="ts" setup>
import { onMounted, ref, computed } from "vue";
import { useAuthStore } from "../../stores/auth";
import { useCurrencyStore } from "../../stores/currency";
import { useModalStore } from "../../stores/modal";
import { useUserProfileStore } from "../../stores/userProfile";
import Modal from "../Modal.vue";
import Cash from "../currency/Cash.vue";

const authStore = useAuthStore();
const currencyStore = useCurrencyStore();
const userProfileStore = useUserProfileStore();
const modalStore = useModalStore();

const copied = ref(false);
const showSignOutConfirm = ref(false);
const isSigningOut = ref(false);
const signOutError = ref("");

async function signOut() {
  if (isSigningOut.value) return;

  isSigningOut.value = true;
  signOutError.value = "";
  try {
    const succeeded = await authStore.signOut();
    if (succeeded) {
      showSignOutConfirm.value = false;
      modalStore.close();
    } else {
      signOutError.value = authStore.error || "Không thể đăng xuất. Vui lòng thử lại.";
    }
  } catch (error) {
    console.error("Lỗi khi đăng xuất:", error);
    signOutError.value = "Không thể đăng xuất. Vui lòng thử lại.";
  } finally {
    isSigningOut.value = false;
  }
}

function copyUserId() {
  const id = authStore.user?.id;
  if (!id) return;
  navigator.clipboard.writeText(id).then(() => {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  });
}

function loadProfile() {
  const userId = authStore.user?.id;
  if (userId) {
    userProfileStore.fetchProfile(userId);
  }
}

onMounted(() => {
  loadProfile();
});

// const formattedCreatedAt = computed(() => {
//   if (!userProfileStore.profile?.created_at) return "Chưa cập nhật";
//   return dayjs(userProfileStore.profile.created_at).format("DD/MM/YYYY HH:mm");
// });

const formattedExp = computed(() => {
  const exp = userProfileStore.profile?.experience_point;
  return exp !== undefined && exp !== null ? Number(exp).toLocaleString("vi-VN") : "0";
});

const maxExp = computed(()=> {
  const level = userProfileStore.profile?.level;
  return level != undefined && level != null ? level * 1000 : 0;
})

const userInitial = computed(() => {
  const email = authStore.user?.email || "";
  return email.length > 0 ? email.charAt(0).toUpperCase() : "U";
});
</script>

<template>
  <Modal title="Thông tin tài khoản" :can-refresh="false">
    <div>
      <!-- Loading State -->
      <div v-if="userProfileStore.loading && !userProfileStore.profile" class="flex flex-col items-center justify-center py-10 gap-3">
        <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs text-gray-500 font-medium">Đang tải hồ sơ...</span>
      </div>

      <!-- Error State -->
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

      <!-- Content -->
      <div v-else class="flex flex-col gap-5">
        <!-- User Highlight Card -->
        <div class="flex items-center gap-4 bg-gradient-to-r from-emerald-50 to-teal-50/70 border border-emerald-100/80 rounded-xl p-4">
          <div class="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xl font-black shadow-md shrink-0">
            {{ userInitial }}
          </div>
          <div class="flex flex-col min-w-0 flex-1">
            <span class="font-bold text-sm text-[#263238] truncate" :title="authStore.user?.email || ''">
              {{ authStore.user?.email || "Chưa cập nhật email" }}
            </span>
            <div class="flex flex-wrap items-center gap-2 mt-1.5">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                ⭐ Cấp {{ userProfileStore.level }}
              </span>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                ✨ {{ formattedExp }} EXP
              </span>
            </div>
          </div>
        </div>

        <!-- Section 1: Chỉ số người chơi (user_profile) -->
        <div>
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Chỉ số cần thủ</div>
          <div class="grid grid-cols-2 gap-2.5">
            <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
              <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
                <span>🎒</span>
                <span>Sức chứa túi đồ</span>
              </div>
              <span class="text-sm font-bold text-[#263238]">
                {{ userProfileStore.inventoryCapacity }} <span class="text-xs font-normal text-gray-500">ô</span>
              </span>
            </div>

            <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
              <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
                <span>🐟</span>
                <span>Sức chứa kho cá</span>
              </div>
              <span class="text-sm font-bold text-[#263238]">
                {{ userProfileStore.speciesStorageCapacity }} <span class="text-xs font-normal text-gray-500">con</span>
              </span>
            </div>

            <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
              <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
                <span>🏆</span>
                <span>Cấp độ</span>
              </div>
              <span class="text-sm font-bold text-[#263238]">
                Level {{ userProfileStore.level }}
              </span>
            </div>

            <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
              <div class="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
                <span>⚡</span>
                <span>Điểm kinh nghiệm</span>
              </div>
              <div class="flex items-center gap-1 text-md text-[#263238]">
                <span class="font-bold ">
                  {{ formattedExp }}
                </span>
                <span>/</span>
                <span>{{ maxExp }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Thông tin tài khoản -->
        <div>
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Chi tiết tài khoản</div>
          <div class="bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100 text-xs">
            <div class="flex justify-between items-center px-3.5 py-2.5">
              <span class="text-gray-500 font-medium">User ID</span>
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-[11px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-700 max-w-[170px] sm:max-w-[220px] truncate">
                  {{ authStore.user?.id || "N/A" }}
                </span>
                <button
                  type="button"
                  class="cursor-pointer text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded transition-colors"
                  @click="copyUserId"
                  title="Sao chép User ID"
                >
                  {{ copied ? "✓ Đã chép" : "Chép" }}
                </button>
              </div>
            </div>

            <div class="flex justify-between items-center px-3.5 py-2.5">
              <span class="text-gray-500 font-medium">Số dư hiện tại</span>
              <Cash :amount="currencyStore.formattedCash" />
            </div>

            <div class="flex justify-between items-center px-3.5 py-2.5">
              <span class="text-gray-500 font-medium">Ngày tham gia</span>
              <!-- <span class="font-medium text-gray-700">{{ formattedCreatedAt }}</span> -->
            </div>
          </div>
        </div>

        <div class="flex items-end">
          <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          @click="showSignOutConfirm = true; signOutError = ''"
          >
          <span aria-hidden="true">
              <img src="/icons/signout.svg?v=2" width="20" alt="" draggable="false">
            </span>
            Đăng xuất
          </button>
        </div>
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