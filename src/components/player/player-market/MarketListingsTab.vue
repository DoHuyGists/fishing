<script setup lang="ts">
import type { MarketListing, MarketViewMode } from '../../../types/model/market';
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { t as tr } from '../../../i18n';
import { useAuthStore } from '../../../stores/auth';
import { useMarketStore } from '../../../stores/player-market-store';
import MarketListingCard from './MarketListingCard.vue';
import MarketToolbar from './MarketToolbar.vue';

const authStore = useAuthStore();
const marketStore = useMarketStore();
const { search, rarity, marketListings } = storeToRefs(marketStore);
const viewMode = defineModel<MarketViewMode>('viewMode', { required: true });
const emit = defineEmits<{ buy: [item: MarketListing] }>();
const groupedListings = computed(() => {
  const groups = new Map<string, MarketListing[]>();
  marketListings.value.forEach((item) => {
    const id = item.caught?.fish?.id || item.caught?.fish?.name || item.id;
    const group = groups.get(id);
    if (group) group.push(item);
    else groups.set(id, [item]);
  });
  return Array.from(groups, ([id, listings]) => ({ id, listings }));
});
</script>

<template>
  <section class="py-4" :aria-busy="marketStore.isLoadingMarket">
    <MarketToolbar v-model:view-mode="viewMode" />
    <div v-if="marketStore.isLoadingMarket" role="status" class="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-white text-sm">
      <div class="size-8 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden="true"></div>
      <span>{{ tr('MarketWindow.dang_tai_cac_ca_dang_giao_dich') }}</span>
    </div>
    <div v-else-if="!marketListings.length" class="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-white px-5 text-center text-sm">
      <span aria-hidden="true" class="flex size-16 items-center justify-center rounded-2xl bg-surface text-3xl">🎣</span>
      <div class="font-medium">{{ search || rarity !== 'ALL' ? tr('MarketWindow.khong_tim_thay_con_ca_nao_phu_hop_voi_bo_loc') : tr('MarketWindow.hien_chua_co_ca_nao_duoc_dang_ban_tren_thi_truong') }}</div>
    </div>
    <div v-else-if="viewMode === 'species'" class="grid items-start gap-5 xl:grid-cols-2">
      <section v-for="group in groupedListings" :key="group.id" class="min-w-0 rounded-2xl border border-border bg-primary/40 p-3">
        <div class="mb-3 flex items-center justify-between gap-3 px-1 py-1">
          <span class="truncate text-base font-bold">{{ group.listings[0]?.caught?.fish?.name || tr('CaughtModal.ca_chua_ro_ten') }}</span>
          <span class="shrink-0 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-medium">{{ group.listings.length }} {{ tr('MarketWindow.tin') }}</span>
        </div>
        <div class="space-y-3">
          <MarketListingCard v-for="item in group.listings" :key="item.id" :item="item" layout="list" :owned="item.user_id === authStore.userId" @buy="emit('buy', $event)" />
        </div>
      </section>
    </div>
    <div v-else :class="viewMode === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4' : 'space-y-3'">
      <MarketListingCard v-for="item in marketListings" :key="item.id" :item="item" :layout="viewMode" :owned="item.user_id === authStore.userId" @buy="emit('buy', $event)" />
    </div>
  </section>
</template>
