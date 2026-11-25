<script setup lang="ts">
import { t as tr } from "../../../i18n/index.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useMarketStore } from "../../../stores/player-market-store.ts";
import { formatDate } from "../../../utils/marketFormatting.ts";
import Cash from "../player-currency/Cash.vue";

const authStore = useAuthStore();
const marketStore = useMarketStore();
</script>

<template>
  <section
    class="space-y-4 py-4 text-sm text-content"
    :aria-busy="marketStore.historyLoading"
    :aria-label="tr('MarketWindow.lich_su_mua_ban_cua_ban')"
  >
    <div
      v-if="marketStore.historyError"
      role="alert"
      class="flex items-center justify-between gap-3 rounded-lg border border-danger bg-surface px-3 py-2 text-xs text-danger"
    >
      <span>{{ marketStore.historyError }}</span>
      <button
        type="button"
        class="shrink-0 font-semibold underline disabled:opacity-40"
        :disabled="marketStore.historyLoading"
        @click="marketStore.loadHistory(authStore.userId)"
      >
        {{ tr("Maintenance.thu_lai") }}
      </button>
    </div>
    <div v-if="marketStore.historyLoading" role="status" class="py-2 text-center text-xs text-content">
      {{ tr("MarketWindow.dang_tai_lich_su") }}
    </div>
    <div
      v-else-if="!marketStore.history.length && !marketStore.historyError"
      class="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-5 py-8 text-center"
    >
      <span aria-hidden="true" class="mb-4 flex size-16 items-center justify-center rounded-2xl bg-surface text-3xl">🧾</span>
      <div class="font-semibold">{{ tr("MarketWindow.chua_co_giao_dich_mua_ban") }}</div>
      <div class="mt-2 text-sm text-content">
        {{ tr("MarketWindow.cac_giao_dich_da_hoan_tat_se_xuat_hien_tai_day") }}
      </div>
    </div>
    <div
      v-if="marketStore.history.length"
      class="slide-fade-in from-bottom player-content-in overflow-hidden rounded-2xl border border-border bg-white"
      :class="marketStore.historyLoading ? 'opacity-60' : ''"
    >
      <div class="divide-y divide-border-default/60">
        <div
          v-for="entry in marketStore.history"
          :key="entry.id"
          class="flex flex-wrap items-center gap-3 px-4 py-4 transition-colors hover:bg-surface sm:gap-4"
        >
          <span
            class="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold"
            :class="
              entry.buyer_id === authStore.userId ? 'border-sky/25 bg-sky/10 text-sky' : 'border-accent/25 bg-accent/10 text-accent'
            "
          >
            {{ entry.buyer_id === authStore.userId ? tr("MarketWindow.da_mua") : tr("MarketWindow.da_ban") }}
          </span>
          <div class="min-w-0 flex-1 basis-32">
            <div class="truncate text-sm font-semibold">
              {{
                entry.item.name ||
                (entry.item.species as any)?.name ||
                (entry.item.fish as any)?.name ||
                tr("CaughtModal.ca")
              }}
            </div>
            <div class="mt-1 text-xs text-content">
              <time :datetime="entry.created_at">{{ formatDate(entry.created_at) }}</time> · #{{ entry.id.slice(0, 8) }}
            </div>
          </div>
          <Cash :amount="entry.price" :size="18" :interactive="false" class="shrink-0 text-sm font-semibold" />
        </div>
      </div>
    </div>
    <nav
      v-if="marketStore.history.length || marketStore.historyPage > 1"
      :aria-label="tr('MarketWindow.phan_trang_lich_su_mua_ban')"
      class="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3 text-sm"
    >
      <button
        type="button"
        :disabled="marketStore.historyLoading || marketStore.historyPage <= 1"
        class="min-h-11 rounded-xl border border-border px-4 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        @click="marketStore.loadHistory(authStore.userId, marketStore.historyPage - 1)"
      >
        {{ tr("Fishfarm.truoc") }}
      </button>
      <span class="text-content">{{ tr("CaughtModal.trang") }} {{ marketStore.historyPage }}</span>
      <button
        type="button"
        :disabled="marketStore.historyLoading || !marketStore.historyHasNext"
        class="min-h-11 rounded-xl border border-border px-4 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        @click="marketStore.loadHistory(authStore.userId, marketStore.historyPage + 1)"
      >
        {{ tr("Fishfarm.sau") }}
      </button>
    </nav>
  </section>
</template>
