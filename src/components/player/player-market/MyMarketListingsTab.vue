<script setup lang="ts">
import type { MarketListing, MarketViewMode } from '../../../types/model/market';
import { computed } from 'vue';
import { t as tr } from '../../../i18n';
import { useAuthStore } from '../../../stores/auth';
import { useMarketStore } from '../../../stores/player-market-store';
import MarketListingCard from './MarketListingCard.vue';

defineProps<{ viewMode: MarketViewMode; isCancellingListing: boolean }>();
const emit = defineEmits<{ cancelListing: [item: MarketListing] }>();
const authStore = useAuthStore();
const marketStore = useMarketStore();
const myMarketListings = computed(() => marketStore.marketListings.filter((item) => item.user_id === authStore.userId));
</script>

<template>
  <section class="py-4" :aria-busy="marketStore.isLoadingMarket">
    <div v-if="marketStore.isLoadingMarket" role="status" class="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-white text-sm">
      <div aria-hidden="true" class="size-8 animate-spin rounded-full border-2 border-border border-t-accent"></div>
      {{ tr('MarketWindow.dang_tai_cac_ca_dang_giao_dich') }}
    </div>
    <div v-else-if="!myMarketListings.length" class="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-white px-5 text-center text-sm">
      <span aria-hidden="true" class="flex size-16 items-center justify-center rounded-2xl bg-surface text-3xl">📦</span>
      <div class="font-semibold">{{ tr('MarketWindow.ban_chua_dang_ban_con_ca_nao_tren_cho') }}</div>
      <div class="max-w-md leading-relaxed">
        {{ tr('MarketWindow.chon_ca_trong_danh_sach_tui_do_ben_phai_va_nhan_nut') }}
        <strong>{{ tr('MarketWindow.ban') }}</strong> {{ tr('MarketWindow.de_rao_ban_ca') }}
      </div>
    </div>
    <div v-else :class="viewMode === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4' : 'space-y-3'">
      <MarketListingCard v-for="item in myMarketListings" :key="item.id" :item="item" :layout="viewMode === 'grid' ? 'grid' : 'list'" manage :busy="isCancellingListing" @cancel-listing="emit('cancelListing', $event)" />
    </div>
  </section>
</template>
