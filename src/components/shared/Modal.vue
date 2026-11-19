<script lang="ts" setup>
import { t as tr } from "../../i18n";

import { computed, onMounted, onUnmounted, ref } from "vue";
import { useModalStore } from "../../stores/player-modal-store.ts";
import { useCurrencyStore } from "../../stores/player-currency-store.ts";
import { useUserProfileStore } from "../../stores/player-user-profile-store.ts";
import Cash from "../player/player-currency/Cash.vue";
import SkillPoints from "../player/player-currency/SkillPoints.vue";
import GuideTour from "./GuideTour.vue";
import UserTurn from "../player/player-stamina/UserTurn.vue";
import Shells from "../player/player-currency/Shells.vue";
import Tickets from "../player/player-currency/Tickets.vue";
import { useReadCacheStore } from "../../stores/player-read-cache.ts";
import { useModalRefresh } from "../../composables/useModalRefresh";

defineOptions({ inheritAttrs: false });

const {
  title = "",
  guidSteps = [],
  onRefresh = undefined,
  showCountData = true,
  compact = false,
  contentWidthClass = "max-w-3xl",
} = defineProps<{
  title?: string;
  guidSteps?: any[];
  onRefresh?: () => void | Promise<void>;
  showCountData?: boolean;
  compact?: boolean;
  contentWidthClass?: string;
}>();
const hasRefreshListener = computed(() => onRefresh != undefined);
const hasGuideSteps = computed(() => guidSteps.length != 0);

const currencyStore = useCurrencyStore();
const userProfileStore = useUserProfileStore();
const modalStore = useModalStore();
const { isRefreshing, refreshCooldown, refreshError, refreshDisabled, handleRefresh } = useModalRefresh(
  () => onRefresh,
  () => useReadCacheStore().invalidate(),
  () => tr("Modal.refresh_error"),
);
const showGuide = ref(false);

function handleGuide() {
  showGuide.value = true;
}

onMounted(() => {
  window.document.body.style.overflowY = "hidden";
});

onUnmounted(() => {
  window.document.body.style.overflowY = "auto";
});
</script>

<template>
  <div
    v-bind="$attrs"
    class="fixed inset-0 z-9999"
    :class="compact ? 'flex items-center justify-center bg-black/40 p-3 backdrop-blur-xs' : ''"
  >
    <div
      class="player-window-panel flex flex-col bg-white"
      :class="
        compact
          ? [
              'max-h-[calc(100dvh-1.5rem)] w-full overflow-hidden rounded-2xl border border-[#cbd9c6] shadow-xl',
              contentWidthClass,
            ]
          : 'h-[100vh] w-screen supports-[height:100dvh]:h-[100dvh]'
      "
    >
      <header
        class="grid grid-cols-2 md:grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2 p-2 border-b border-emerald-950/10 bg-[#e7ecda] sm:flex-nowrap sm:gap-4"
      >
        <div class="min-w-0 flex-1 sm:flex-none order-1 md:order-1">
          <div class="m-0 mt-1 break-words text-lg font-bold sm:text-xl">{{ title }}</div>
        </div>
        <div
          v-if="showCountData"
          class="order-3 md:order-2 col-span-2 md:col-span-1 flex flex-row items-center md:justify-center shrink-0 gap-1 text-xs md:text-sm"
        >
          <Cash :amount="currencyStore.formattedCash" />
          <Shells :amount="currencyStore.formattedShells" />
          <Tickets :amount="currencyStore.formattedTickets" />
          <SkillPoints :amount="userProfileStore.skillPoints" />
          <UserTurn />
        </div>
        <div class="order-2 md:order-3 flex items-center justify-end shrink-0 gap-1 sm:ml-0 sm:gap-2">
          <button
            v-if="hasGuideSteps"
            type="button"
            class="px-2 py-2 rounded-md border border-emerald-900/15 bg-white/70 text-xs font-bold text-emerald-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed sm:px-3 sm:text-sm"
            :disabled="isRefreshing"
            @click="handleGuide"
          >
            <span aria-hidden="true" class="mr-1">{{ tr("FeatureTable.huong_dan") }}</span>
          </button>
          <button
            v-if="hasRefreshListener"
            type="button"
            class="px-2 py-2 rounded-md border border-emerald-900/15 bg-white/70 text-xs font-bold text-emerald-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed sm:px-3 sm:text-sm"
            :disabled="refreshDisabled"
            :aria-busy="isRefreshing"
            @click="handleRefresh"
          >
            <span aria-hidden="true" class="mr-1">↻</span
            >{{ isRefreshing ? tr("Modal.refreshing") : refreshCooldown > 0 ? `${refreshCooldown}s` : tr("Modal.lam_moi") }}
          </button>
          <button
            type="button"
            class="w-9 h-9 rounded-full border border-emerald-900/15 bg-white/70 text-emerald-950 hover:bg-white text-2xl leading-none cursor-pointer"
            :aria-label="tr('ChangePasswordModal.dong')"
            @click="modalStore.close"
          >
            ×
          </button>
        </div>
      </header>
      <div v-if="refreshError" role="alert" class="border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {{ refreshError }}
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
        <slot></slot>
      </div>
    </div>
  </div>
  <GuideTour v-if="showGuide && hasGuideSteps" :steps="guidSteps" @finish="showGuide = false" />
</template>
