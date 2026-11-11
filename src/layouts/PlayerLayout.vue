<script lang="ts" setup>
import { t as tr } from "../i18n";

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
import { useUserProfileStore } from "../stores/userProfile";
import { useFishingStore } from "../stores/fishing";

const router = useRouter();
const authStore = useAuthStore();
const currencyStore = useCurrencyStore();
const userInAreaStore = useUserInAreaStore();
const configStore = useConfigStore();
const userProfileStore = useUserProfileStore();
const fishingStore = useFishingStore();
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
  userProfileStore.fetchProfile(authStore.userId);
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
    // The route guard owns navigation while it finishes the trip.
    if (fishingStore.isLeavingArea || fishingStore.hasLeftArea) return;
    if (session) {
      if (session.status == "enter" && router.currentRoute.value.name !== "fishing" && router.currentRoute.value.name !== "admin") {
        router.replace({ name: "fishing" });
      } else if (session.status == null && router.currentRoute.value.name === "fishing") {
        router.replace({ name: "home" });
      }
    }
  },
);

watch(
  () => userProfileStore.profile?.level,
  (userProfile) => {
    configStore.loadConfig(userProfile == null ? null : { level: userProfile });
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
        :title="tr('PlayerLayout.phat_hien_trung_phien_truy_cap')"
        :message="modalMessage"
        :sub-text="tr('PostProduction.ban_vui_long_chon_thao_tac_tiep_theo')"
        :first-text="tr('PlayerLayout.dong_tab_nay')"
        :second-text="tr('PlayerLayout.dang_xuat_tai_khoan')"
        :on-first="closeCurrentTab"
        :on-second="logoutAccount"
      />
    </Teleport>
  </div>
</template>
