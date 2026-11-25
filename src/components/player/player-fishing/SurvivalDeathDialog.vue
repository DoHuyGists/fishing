<script setup lang="ts">
import { useRouter } from 'vue-router';
import { nextTick, ref, watch } from 'vue';
import { t as tr } from '../../../i18n';
import { useFishingStore } from '../../../stores/player-fishing-store';

const fishing = useFishingStore();
const router = useRouter();
const dialog = ref<HTMLDialogElement>();
watch(() => fishing.survival?.dead, async (dead) => {
  await nextTick();
  if (dead && dialog.value && !dialog.value.open) dialog.value.showModal();
  else if (!dead && dialog.value?.open) dialog.value.close();
}, { immediate: true });
</script>

<template>
  <dialog ref="dialog" class="player-popup-in m-auto w-[calc(100%_-_2rem)] max-w-sm space-y-4 rounded-xl border border-danger bg-surface p-5 text-content shadow-xl backdrop:bg-content/70" role="alertdialog" aria-modal="true" aria-labelledby="survival-death-title" aria-describedby="survival-death-loss" @cancel.prevent>
      <div id="survival-death-title" class="text-lg font-bold text-danger">{{ tr('FishingSurvival.dead') }}</div>
      <div id="survival-death-loss">{{ tr('FishingSurvival.loss', { count: fishing.survival?.lost_fish ?? 0 }) }}</div>
      <div v-if="fishing.leaveAreaError" role="status" class="text-sm text-danger">{{ fishing.leaveAreaError }}</div>
      <button v-if="fishing.pendingResult" type="button" :disabled="fishing.castPhase === 'submitting'" class="w-full rounded-lg border border-border-default px-4 py-2 disabled:opacity-50" @click="fishing.retryPendingResult()">
        {{ tr('Maintenance.thu_lai') }}
      </button>
      <button
        type="button"
        autofocus
        :disabled="fishing.isLeavingArea"
        class="w-full rounded-lg bg-danger px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        @click="router.push({ name: 'home' })"
      >
        {{ tr('FishingView.quay_lai_ban_do') }}
      </button>
  </dialog>
</template>
