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
    class="shared-modal fixed inset-0 z-9999"
    :class="compact ? 'flex items-center justify-center bg-content/40 p-3 backdrop-blur-xs' : ''"
  >
    <div
      class="shared-modal__panel player-window-panel flex flex-col bg-white"
      :class="
        [
          { 'slide-fade-in from-bottom player-modal-restored': modalStore.restoredEntrance },
          compact
          ? [
              'max-h-[calc(100dvh-1.5rem)] w-full overflow-hidden rounded-2xl border border-border-default shadow-xl',
              contentWidthClass,
            ]
          : 'h-[100vh] w-screen supports-[height:100dvh]:h-[100dvh]',
        ]
      "
    >
      <header
        class="shared-modal__header grid grid-cols-2 md:grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2 p-2 border-b border-accent/10 bg-surface-muted sm:flex-nowrap sm:gap-4"
      >
        <div class="min-w-0 flex-1 sm:flex-none order-1 md:order-1">
          <div class="shared-modal__title m-0 mt-1 break-words text-lg font-bold sm:text-xl">{{ title }}</div>
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
            class="px-2 py-2 rounded-md border border-accent/15 bg-white/70 text-xs font-bold text-content hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed sm:px-3 sm:text-sm"
            :disabled="isRefreshing"
            @click="handleGuide"
          >
            <span aria-hidden="true" class="mr-1">{{ tr("FeatureTable.huong_dan") }}</span>
          </button>
          <button
            v-if="hasRefreshListener"
            type="button"
            class="px-2 py-2 rounded-md border border-accent/15 bg-white/70 text-xs font-bold text-content hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed sm:px-3 sm:text-sm"
            :disabled="refreshDisabled"
            :aria-busy="isRefreshing"
            @click="handleRefresh"
          >
            <span aria-hidden="true" class="mr-1">↻</span
            >{{ isRefreshing ? tr("Modal.refreshing") : refreshCooldown > 0 ? `${refreshCooldown}s` : tr("Modal.lam_moi") }}
          </button>
          <button
            type="button"
            class="w-9 h-9 rounded-full border border-accent/15 bg-white/70 text-content hover:bg-white text-2xl leading-none cursor-pointer"
            :aria-label="tr('ChangePasswordModal.dong')"
            @click="modalStore.close"
          >
            ×
          </button>
        </div>
      </header>
      <div v-if="refreshError" role="alert" class="border-b border-danger bg-surface px-3 py-2 text-sm text-danger">
        {{ refreshError }}
      </div>
      <div class="shared-modal__content min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
        <slot></slot>
      </div>
    </div>
  </div>
  <GuideTour v-if="showGuide && hasGuideSteps" :steps="guidSteps" @finish="showGuide = false" />
</template>

<style scoped>
.ocean-theme .shared-modal__panel {
  color: var(--color-content);
  background: var(--color-surface);
  border-color: color-mix(in srgb, var(--color-ocean-gold) 70%, transparent);
  box-shadow: 0 24px 80px color-mix(in srgb, var(--color-content) 50.196%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--color-gold) 10.196%, transparent);
}

.ocean-theme .shared-modal__header {
  padding: 0.75rem;
  border-bottom-color: color-mix(in srgb, var(--color-ocean-gold) 65%, transparent);
  background: linear-gradient(135deg, var(--color-ocean-panel), var(--color-ocean-deep));
  box-shadow: 0 3px 16px color-mix(in srgb, var(--color-content) 25.098%, transparent), inset 0 1px color-mix(in srgb, var(--color-surface) 10.196%, transparent);
}

.ocean-theme .shared-modal__title {
  color: var(--color-ocean-pearl);
  text-shadow: 0 2px 3px color-mix(in srgb, var(--color-content) 40%, transparent);
}

.ocean-theme .shared-modal__header button {
  color: var(--color-ocean-pearl);
  border-color: color-mix(in srgb, var(--color-ocean-gold) 55%, transparent);
  background: var(--color-ocean-deep);
  box-shadow: inset 0 1px color-mix(in srgb, var(--color-surface) 7.843%, transparent);
  transition: border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease;
}

.ocean-theme .shared-modal__header button:hover:not(:disabled) {
  background: var(--color-ocean-panel);
  border-color: var(--color-ocean-cyan);
  box-shadow: 0 0 12px color-mix(in srgb, var(--color-sky) 14.902%, transparent);
}

.ocean-theme .shared-modal__header button:focus-visible {
  outline: 2px solid var(--color-ocean-cyan);
  outline-offset: 2px;
}

.ocean-theme .shared-modal__content {
  background: radial-gradient(ellipse at 90% 0%, color-mix(in srgb, var(--color-sky) 3.922%, transparent), transparent 65%);
}
</style>
