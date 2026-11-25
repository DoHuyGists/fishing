<script setup lang="ts">
import { computed } from "vue";
import type { MarketListing } from "../../../types/model/market";
import { getFormattingLocale, t as tr } from "../../../i18n";
import { formatDate, getRarityBadgeClass } from "../../../utils/marketFormatting";

const props = defineProps<{
  item: MarketListing;
  layout?: 'grid' | 'list';
  owned?: boolean;
  manage?: boolean;
  busy?: boolean;
}>();
const emit = defineEmits<{ buy: [item: MarketListing]; cancelListing: [item: MarketListing] }>();
const fishName = computed(() => props.item.caught?.fish?.name || tr('CaughtModal.ca_chua_ro_ten'));
</script>

<template>
  <article
    class="market-card slide-fade-in from-bottom player-content-in group min-w-0 rounded-2xl border border-border bg-white p-3 transition-shadow hover:shadow-md"
    :class="layout === 'list' ? 'market-card--list' : 'flex flex-col'"
  >
    <div class="market-card__image relative flex items-center justify-center overflow-hidden rounded-xl bg-surface">
      <img
        v-if="item.caught?.fish?.image"
        :src="item.caught.fish.image"
        :alt="fishName"
        loading="lazy"
        class="h-full w-full object-contain p-3 transition-transform duration-300 motion-safe:group-hover:scale-105"
      />
      <svg v-else role="img" :aria-label="fishName" class="h-16 w-24 text-accent/50" fill="none" stroke="currentColor" stroke-width="1.25" viewBox="0 0 64 40">
        <path d="M8 20C18 3 39 3 49 20 39 37 18 37 8 20Zm41 0 11-11v22L49 20ZM25 7l7-5 7 7M25 33l7 5 7-7M23 9c7 5 7 17 0 22" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="17" cy="17" r="1.5" fill="currentColor" stroke="none" />
      </svg>
      <span v-if="item.caught?.fish?.rarity" class="absolute right-2 top-2 rounded-md border px-2 py-1 text-xs font-semibold" :class="getRarityBadgeClass(item.caught.fish.rarity)">
        {{ item.caught.fish.rarity }}
      </span>
      <span v-if="owned && !manage" class="absolute bottom-2 left-2 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-content">
        {{ tr('MarketWindow.ca_cua_ban') }}
      </span>
    </div>
    <div class="market-card__details min-w-0 py-3">
      <div class="truncate text-base font-bold text-content" :title="fishName">{{ fishName }}</div>
      <div class="mt-2 flex items-center gap-2 text-sm text-content">
        <svg aria-hidden="true" class="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 3v18M5 21h14M4 7h16M6 7l-4 8h8L6 7Zm12 0-4 8h8l-4-8Z" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span>{{ item.caught?.fish?.weight }} kg</span>
      </div>
      <div class="mt-2 text-xs leading-relaxed text-content">
        {{ manage ? tr('MarketWindow.ngay_dang') : tr('MarketWindow.dang_ban') }}
        <time :datetime="item.created_at">{{ formatDate(item.created_at) }}</time>
      </div>
    </div>
    <div class="market-card__footer mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
      <div class="min-w-0">
        <div class="text-xs font-medium text-content">{{ manage ? tr('MarketWindow.gia_niem_yet') : tr('MarketWindow.gia_ban') }}</div>
        <div class="mt-1 break-words text-lg font-bold tabular-nums text-accent">
          {{ item.price.toLocaleString(getFormattingLocale()) }} <span class="text-sm">{{ tr('currency.cashUnit') }}</span>
        </div>
      </div>
      <button v-if="manage" type="button" :disabled="busy" class="min-h-11 rounded-xl border border-danger/40 px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:cursor-wait disabled:opacity-50" @click="emit('cancelListing', item)">
        {{ busy ? tr('MarketWindow.dang_go') : tr('MarketWindow.go_ban') }}
      </button>
      <span v-else-if="owned" class="inline-flex min-h-11 items-center rounded-xl bg-surface px-4 text-sm text-content">{{ tr('MarketWindow.da_dang') }}</span>
      <button v-else type="button" class="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-content" @click="emit('buy', item)">
        {{ tr('MarketWindow.mua_ca') }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.market-card__image { height: 11rem; }
.market-card--list { display: grid; grid-template-columns: 7rem minmax(0, 1fr); gap: 0 1rem; }
.market-card--list .market-card__image { height: 7rem; }
.market-card--list .market-card__details { align-self: center; padding-top: 0; }
.market-card--list .market-card__footer { grid-column: 1 / -1; margin-top: 0.75rem; }
@media (min-width: 640px) {
  .market-card--list { grid-template-columns: 9rem minmax(0, 1fr) minmax(12rem, auto); align-items: center; }
  .market-card--list .market-card__footer { grid-column: auto; margin-top: 0; padding: 0 0 0 1.25rem; border-top: 0; border-left: 1px solid var(--color-border); }
  .market-card--list .market-card__details { padding-bottom: 0; }
}
</style>
