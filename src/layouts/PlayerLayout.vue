<script lang="ts" setup>
import { t as tr } from "../i18n";

import { onBeforeMount, watch } from "vue";
import { startVisibleRefresh } from "../utils/visibleRefresh";
import { usePlayerRefreshStore } from "../stores/playerRefresh";
import { useSingleSession } from "../composables/use-single-session";
import { useAuthStore } from "../stores/auth";
import { useTimezoneCheck } from "../composables/use-timezone-check";
import { useRouter } from "vue-router";
import { useCurrencyStore } from "../stores/currency";
import { useUserInAreaStore } from "../stores/userInArea";
import TwoOptionsModal from "../components/shared/TwoOptionsModal.vue";
import { useConfigStore } from "../stores/config.ts";
import { useUserProfileStore } from "../stores/userProfile";
import { useFishingStore } from "../stores/fishing";
import { useFeatureAvailabilityStore } from "../stores/featureAvailability";

const router = useRouter();
const authStore = useAuthStore();
const currencyStore = useCurrencyStore();
const userInAreaStore = useUserInAreaStore();
const configStore = useConfigStore();
const userProfileStore = useUserProfileStore();
const fishingStore = useFishingStore();
const features = useFeatureAvailabilityStore();
const refresh = usePlayerRefreshStore();
const { showConflictModal, modalMessage, closeCurrentTab, logoutAccount } = useSingleSession(authStore.userId);
onBeforeMount(async () => { await useTimezoneCheck(); });
watch(() => authStore.user?.id, (userId, _, onCleanup) => {
  currencyStore.$reset();
  userProfileStore.$reset();
  userInAreaStore.$reset();
  if (!userId) return;
  const stopArea = startVisibleRefresh(() => refresh.refresh(userId, ['area']), 15_000);
  const stopWallet = startVisibleRefresh(() => refresh.refresh(userId, ['currency', 'profile']), 60_000);
  onCleanup(() => { stopArea(); stopWallet(); });
}, { immediate: true });

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
    } else if (router.currentRoute.value.name === "fishing") {
      router.replace({ name: "home" });
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
    <router-view v-if="features.ready" />
    <div v-else class="m-4 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 text-[#24352a]" role="status">
      {{ tr(features.error ? 'FeatureAvailability.loadError' : 'FeatureAvailability.loading') }}
      <button v-if="features.error" type="button" class="ml-2 underline disabled:opacity-50" :disabled="features.loading" @click="features.load(true)">
        {{ tr('Maintenance.thu_lai') }}
      </button>
    </div>

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
