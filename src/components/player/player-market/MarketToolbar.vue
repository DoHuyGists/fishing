<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { MarketViewMode } from '../../../types/model/market';
import { useMarketStore } from '../../../stores/player-market-store';
import { t as tr } from '../../../i18n';

const { search, rarity, sort } = storeToRefs(useMarketStore());
const viewMode = defineModel<MarketViewMode>('viewMode', { required: true });
const modes = [
  { key: 'list', label: 'CaughtModal.danh_sach', path: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { key: 'grid', label: 'CaughtModal.luoi', path: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { key: 'species', label: 'CaughtModal.theo_loai', path: 'M3 5h18M3 12h7M3 19h7M14 9h7v12h-7z' },
] as const;
</script>

<template>
  <div class="mb-5 grid gap-3 rounded-2xl border border-border bg-white p-3 sm:p-4 xl:grid-cols-[minmax(12rem,1fr)_auto]">
    <label class="relative block self-end">
      <svg aria-hidden="true" class="pointer-events-none absolute left-3.5 top-3.5 size-5 text-accent" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" stroke-linecap="round" /></svg>
      <input v-model="search" type="search" :aria-label="tr('MarketWindow.tim_kiem_ca_rao_ban')" :placeholder="tr('MarketWindow.tim_kiem_ca_rao_ban')" class="min-h-12 w-full rounded-xl border border-border bg-surface py-3 pl-11 pr-3 text-sm text-content focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15" />
    </label>
    <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
      <label class="min-w-0 sm:flex-1 lg:w-40">
        <span class="mb-1.5 block text-sm font-medium">{{ tr('MarketWindow.do_hiem') }}</span>
        <select v-model="rarity" class="market-select min-h-12 w-full rounded-xl border border-border bg-surface py-2 pl-3 pr-8 text-sm">
          <option value="ALL">{{ tr('Achievement.tat_ca') }}</option>
          <option value="HUYỀN THOẠI">{{ tr('WeatherSection.huyen_thoai') }}</option>
          <option value="SỬ THI">{{ tr('WeatherSection.su_thi') }}</option>
          <option value="HIẾM">{{ tr('WeatherSection.hiem') }}</option>
          <option value="THƯỜNG">{{ tr('LatestCaughtList.thuong') }}</option>
        </select>
      </label>
      <label class="min-w-0 sm:flex-1 lg:w-44">
        <span class="mb-1.5 block text-sm font-medium">{{ tr('MarketWindow.sap_xep') }}</span>
        <select v-model="sort" class="market-select min-h-12 w-full rounded-xl border border-border bg-surface py-2 pl-3 pr-8 text-sm">
          <option value="newest">{{ tr('MarketWindow.moi_nhat') }}</option>
          <option value="price-asc">{{ tr('MarketWindow.gia_thap_cao') }}</option>
          <option value="price-desc">{{ tr('MarketWindow.gia_cao_thap') }}</option>
        </select>
      </label>
      <div class="col-span-2 flex shrink-0 self-end gap-1 rounded-xl border border-border bg-surface p-1" role="group" :aria-label="tr('CaughtModal.che_do_hien_thi')">
        <button v-for="mode in modes" :key="mode.key" type="button" class="flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm font-medium transition-colors sm:px-3" :class="viewMode === mode.key ? 'bg-accent text-white shadow-xs' : 'text-content hover:bg-primary'" :aria-pressed="viewMode === mode.key" @click="viewMode = mode.key">
          <svg aria-hidden="true" class="hidden size-4 shrink-0 sm:block" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path :d="mode.path" stroke-linecap="round" stroke-linejoin="round" /></svg>
          <span>{{ tr(mode.label) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.market-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%232f392b' stroke-width='1.5'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E");
  background-position: right 0.65rem center;
  background-repeat: no-repeat;
}
</style>
