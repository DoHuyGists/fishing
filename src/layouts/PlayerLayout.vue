<script lang="ts" setup>
import { onBeforeMount, onBeforeUnmount, onMounted, watch } from "vue";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSingleSession } from "../composables/use-single-session";
import { useAuthStore } from "../stores/auth";
import { useTimezoneCheck } from "../composables/use-timezone-check";
import { useRouter } from "vue-router";
import { useCurrencyStore } from "../stores/currency";
import { supabaseCurrencyRepository } from "../data/supabaseCurrencyRepository";
import { supabaseUserInAreaRepository } from "../data/supabaseUserInAreaRepository";
import { useUserInAreaStore } from "../stores/userInArea";
import TwoOptionsModal from "../components/shared/TwoOptionsModal.vue";
import { useConfigStore } from "../stores/config.ts";

const router = useRouter();
const authStore = useAuthStore();
const currencyStore = useCurrencyStore();
const userInAreaStore = useUserInAreaStore();
const configStore = useConfigStore();
let currencyChannel: RealtimeChannel | null = null;
let userInAreaChannel: ReturnType<typeof supabaseUserInAreaRepository.subscribeToAreaUsers> | null = null;

const { showConflictModal, modalMessage, closeCurrentTab, logoutAccount } = useSingleSession(authStore.userId);

onBeforeMount(async () => {
  await useTimezoneCheck();
  // Lắng nghe user_in_area thay đổi để chuyển hướng user về đúng màn hình
  if (!userInAreaChannel) {
    userInAreaChannel = supabaseUserInAreaRepository.subscribeToAreaUsers(async () => {
      userInAreaStore.setCurrentUserInArea(authStore.userId);
    });
  }

  // Lắng nghe để đồng bộ currency
  currencyChannel = supabaseCurrencyRepository.subscribeToCurrency(authStore.userId, () => {
    currencyStore.fetchCurrency();
  });
});

onMounted(() => {
  userInAreaStore.setCurrentUserInArea(authStore.userId);
  currencyStore.fetchCurrency();
});

onBeforeUnmount(() => {
  if (userInAreaChannel) {
    supabaseUserInAreaRepository.unsubscribe(userInAreaChannel);
    userInAreaChannel = null;
  }
  if (currencyChannel) {
    supabaseCurrencyRepository.unsubscribe(currencyChannel);
    currencyChannel = null;
  }
});

watch(
  () => userInAreaStore.userInArea,
  (session) => {
    if (session) {
      if (session.status == "enter") {
        router.replace({ name: "fishing" });
      } else if (session.status == null) {
        router.replace({ name: "home" });
      }
    }
  },
);

watch(
  () => authStore.profile,
  (userProfile) => {
    if (userProfile != null) {
      configStore.loadConfig(userProfile);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <router-view />

    <!-- Dialog Cảnh Báo Trùng Tab / Cross-Browser -->
    <Teleport to="body">
      <TwoOptionsModal
        v-if="showConflictModal"
        title="⚠️ Phát hiện trùng phiên truy cập"
        :message="modalMessage"
        sub-text="Bạn vui lòng chọn thao tác tiếp theo:"
        first-text="Đóng tab này"
        second-text="Đăng xuất tài khoản"
        :on-first="closeCurrentTab"
        :on-second="logoutAccount"
      />
    </Teleport>
  </div>
</template>
