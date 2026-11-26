<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef, watch } from "vue";
import { t as tr } from "../../../i18n";
import { useAuthStore } from "../../../stores/auth";
import { useModalStore } from "../../../stores/player-modal-store";
import { useUserSettingStore } from "../../../stores/player-user-setting-store";
import Modal from "../../shared/Modal.vue";

const authStore = useAuthStore();
const modalStore = useModalStore();
const settings = useUserSettingStore();
const content = useTemplateRef<HTMLDivElement>("content");
const previousFocus = document.activeElement;

watch(
  () => authStore.user?.id,
  (id) => void settings.load(id ?? null),
  { immediate: true },
);

onMounted(() => content.value?.focus({ preventScroll: true }));
onUnmounted(() => {
  if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
});
</script>

<template>
  <Modal
    :title="tr('FishingView.cai_dat')"
    :show-count-data="false"
    compact
    content-width-class="max-w-lg"
    role="dialog"
    aria-modal="true"
    :aria-label="tr('FishingView.cai_dat')"
    @keydown.esc.stop="modalStore.close()"
  >
    <div ref="content" tabindex="-1" class="space-y-4 text-content outline-none">
      <div class="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-surface p-4">
        <div id="game-settings-sound-label" class="font-bold">{{ tr("FishingView.am_thanh_nen") }}</div>
        <button
          type="button"
          role="switch"
          aria-labelledby="game-settings-sound-label"
          :aria-checked="settings.isFishingBackgroundSoundTurnOn"
          :disabled="!settings.ready || settings.saving"
          class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border-default transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50"
          :class="settings.isFishingBackgroundSoundTurnOn ? 'bg-accent' : 'bg-surface-muted'"
          @click="settings.toggleFishingBackgroundSound()"
        >
          <span
            aria-hidden="true"
            class="h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
            :class="settings.isFishingBackgroundSoundTurnOn ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>
      </div>
      <div v-if="settings.loading || settings.saving" role="status" class="text-sm">
        {{ settings.loading ? tr("FishingView.dang_tai_cai_dat") : tr("FishingView.dang_luu_cai_dat") }}
      </div>
      <div v-if="settings.error" role="alert" class="text-sm text-danger">
        <div>{{ settings.error }}</div>
        <button
          v-if="!settings.ready"
          type="button"
          class="mt-2 underline"
          @click="settings.load(authStore.user?.id ?? null)"
        >
          {{ tr("Maintenance.thu_lai") }}
        </button>
      </div>
    </div>
  </Modal>
</template>
