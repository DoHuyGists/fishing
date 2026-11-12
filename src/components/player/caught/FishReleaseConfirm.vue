<script setup lang="ts">
import { t as tr } from "../../../i18n";

defineProps<{ fish: any; isLoading?: boolean }>();
const emit = defineEmits<{ cancel: []; confirm: [] }>();


</script>

<template>
  <div v-if="fish" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs" @click.self="emit('cancel')">
    <div class="player-popup-in w-full max-w-sm rounded-xl border border-gray-300 bg-white p-5 text-center shadow-xl">
      <div class="m-0 text-base font-bold text-[#263238]">{{ tr('FishReleaseConfirm.xac_nhan_tha_ca') }}</div>
      <div class="my-4 text-xs leading-relaxed text-gray-600">
        {{ tr('FishReleaseConfirm.ban_co_chac_chan_muon_tha') }} <strong class="text-[#153221]">{{ fish.species?.name }}</strong> {{ tr('FishReleaseConfirm.ve_lai_tu_nhien_khong') }}
      </div>
      <div class="mt-5 flex justify-center gap-3">
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-bold hover:bg-gray-100" @click="emit('cancel')">{{ tr('AccountInfoModal.huy') }}</button>
        <button type="button" class="rounded-lg border border-red-600 bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50" :disabled="isLoading" @click="emit('confirm')">
          {{ isLoading ? tr('FishReleaseConfirm.dang_tha') : tr('FishReleaseConfirm.xac_nhan_tha') }}
        </button>
      </div>
    </div>
  </div>
</template>
