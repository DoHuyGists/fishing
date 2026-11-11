<script lang="ts" setup>
import { getFormattingLocale } from '../../../i18n';
import { t as tr } from "../../../i18n";

import { computed} from "vue";

import { useCaughtStore } from "../../../stores/caught.ts";

const caughtStore = useCaughtStore();

const recentCaughtFishes = computed(() => caughtStore.inNetFishes);

</script>
<template>
  <section class="w-full max-w-sm rounded-xl border border-emerald-900/15 bg-white/95 p-3 shadow-sm">
    <div class="mb-2 flex items-center justify-between">
      <div class="m-0 text-sm font-bold text-[#153221]">{{ tr('CaughtModal.luoi') }}</div>
      <span class="text-[11px] text-gray-500">{{ recentCaughtFishes.length }} {{ tr('Fishfarm.ca_2') }}</span>
    </div>
    <div
      v-if="caughtStore.isLoadingCaught && !recentCaughtFishes.length"
      class="m-0 py-3 text-center text-xs text-gray-500"``
    >
      {{ tr('LatestCaughtList.dang_tai_danh_sach_loai_vua_cau') }}
    </div>
    <div v-else-if="!recentCaughtFishes.length" class="m-0 py-3 text-center text-xs text-gray-500">
      {{ tr('LatestCaughtList.chua_cau_duoc_con_nao') }}
    </div>
    <div v-else class="m-0 max-h-[min(55vh,520px)] list-none space-y-2 overflow-y-auto p-0">
      <div
        v-for="(fish, index) in recentCaughtFishes"
        :key="fish.id"
        class="flex min-w-0 items-center gap-2 rounded-lg bg-emerald-50/70 p-2"
      >
        <img
          :src="fish.species?.image || '/fish/VN/fish.jpg'"
          :alt="fish.species?.name || tr('CaughtModal.ca')"
          class="h-10 w-1/3 shrink-0 rounded-md object-cover"
          draggable="false"
        />
        <div class="min-w-0 flex-1">
          <div class="m-0 truncate text-xs font-bold text-gray-800">{{ fish.species?.name || tr('CaughtModal.ca_chua_ro_ten') }}</div>
          <div class="m-0 text-[10px] text-gray-500">
            {{ fish.species?.rarity || tr('LatestCaughtList.thuong') }} ·
            {{ fish.created_at ? new Date(fish.created_at).toLocaleDateString(getFormattingLocale()) : "" }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
