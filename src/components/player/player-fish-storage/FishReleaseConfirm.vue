<script setup lang="ts">
import { t as tr } from "../../../i18n";

defineProps<{ fish: any; isLoading?: boolean }>();
const emit = defineEmits<{ cancel: []; confirm: [] }>();


</script>

<template>
  <div v-if="fish" class="fixed inset-0 z-[10000] flex items-center justify-center bg-content/50 p-4 backdrop-blur-xs" @click.self="emit('cancel')">
    <div class="player-popup-in w-full max-w-sm rounded-xl border border-content bg-white p-5 text-center shadow-xl">
      <div class="m-0 text-base font-bold text-content">{{ tr('FishReleaseConfirm.xac_nhan_tha_ca') }}</div>
      <div class="my-4 text-xs leading-relaxed text-content">
        {{ tr('FishReleaseConfirm.ban_co_chac_chan_muon_tha') }} <strong class="text-content-strong">{{ fish.species?.name }}</strong> {{ tr('FishReleaseConfirm.ve_lai_tu_nhien_khong') }}
      </div>
      <div class="mt-5 flex justify-center gap-3">
        <button type="button" class="rounded-lg border border-content px-4 py-1.5 text-xs font-bold hover:bg-surface" @click="emit('cancel')">{{ tr('AccountInfoModal.huy') }}</button>
        <button type="button" class="rounded-lg border border-danger bg-danger px-4 py-1.5 text-xs font-bold text-white hover:bg-danger disabled:opacity-50" :disabled="isLoading" @click="emit('confirm')">
          {{ isLoading ? tr('FishReleaseConfirm.dang_tha') : tr('FishReleaseConfirm.xac_nhan_tha') }}
        </button>
      </div>
    </div>
  </div>
</template>
