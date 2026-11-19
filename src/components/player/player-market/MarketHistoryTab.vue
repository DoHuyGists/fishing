<script setup lang="ts">
import { t as tr } from "../../../i18n/index.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useMarketStore } from "../../../stores/market.ts";
import { formatDate } from "../../../utils/marketFormatting.ts";
import Cash from "../player-currency/Cash.vue";

const authStore = useAuthStore();
const marketStore = useMarketStore();
</script>

<template>
  <section
    class="space-y-3 py-2 text-sm text-[#24352a]"
    :aria-busy="marketStore.historyLoading"
    :aria-label="tr('MarketWindow.lich_su_mua_ban_cua_ban')"
  >
    <div
      v-if="marketStore.historyError"
      role="alert"
      class="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
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
    <div v-if="marketStore.historyLoading" role="status" class="py-2 text-center text-xs text-gray-500">
      {{ tr("MarketWindow.dang_tai_lich_su") }}
    </div>
    <div
      v-else-if="!marketStore.history.length && !marketStore.historyError"
      class="rounded-xl border border-dashed border-[#cbd9c6] bg-[#f5f9f0] px-4 py-8 text-center"
    >
      <div class="font-semibold">{{ tr("MarketWindow.chua_co_giao_dich_mua_ban") }}</div>
      <div class="mt-1 text-xs text-gray-500">
        {{ tr("MarketWindow.cac_giao_dich_da_hoan_tat_se_xuat_hien_tai_day") }}
      </div>
    </div>
    <div
      v-if="marketStore.history.length"
      class="slide-fade-in from-bottom player-content-in max-h-[min(50dvh,26rem)] overflow-y-auto rounded-xl border border-[#cbd9c6]"
      :class="marketStore.historyLoading ? 'opacity-60' : ''"
    >
      <div class="divide-y divide-[#cbd9c6]/60">
        <div
          v-for="entry in marketStore.history"
          :key="entry.id"
          class="flex items-center gap-2 bg-[#f5f9f0]/60 px-3 py-2.5 sm:gap-3"
        >
          <span
            class="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold"
            :class="
              entry.buyer_id === authStore.userId ? 'bg-blue-50 text-blue-700' : 'bg-emerald-100 text-emerald-800'
            "
          >
            {{ entry.buyer_id === authStore.userId ? tr("MarketWindow.da_mua") : tr("MarketWindow.da_ban") }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs font-semibold">
              {{
                entry.item.name ||
                (entry.item.species as any)?.name ||
                (entry.item.fish as any)?.name ||
                tr("CaughtModal.ca")
              }}
            </div>
            <div class="mt-0.5 text-[11px] text-gray-500">
              <time :datetime="entry.created_at">{{ formatDate(entry.created_at) }}</time> · #{{ entry.id.slice(0, 8) }}
            </div>
          </div>
          <Cash :amount="entry.price" :size="16" :interactive="false" class="shrink-0 text-xs font-semibold" />
        </div>
      </div>
    </div>
    <nav
      v-if="marketStore.history.length || marketStore.historyPage > 1"
      :aria-label="tr('MarketWindow.phan_trang_lich_su_mua_ban')"
      class="flex items-center justify-between gap-3 text-xs"
    >
      <button
        type="button"
        :disabled="marketStore.historyLoading || marketStore.historyPage <= 1"
        class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 hover:bg-[#f5f9f0] disabled:cursor-not-allowed disabled:opacity-40"
        @click="marketStore.loadHistory(authStore.userId, marketStore.historyPage - 1)"
      >
        {{ tr("Fishfarm.truoc") }}
      </button>
      <span class="text-gray-500">{{ tr("CaughtModal.trang") }} {{ marketStore.historyPage }}</span>
      <button
        type="button"
        :disabled="marketStore.historyLoading || !marketStore.historyHasNext"
        class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 hover:bg-[#f5f9f0] disabled:cursor-not-allowed disabled:opacity-40"
        @click="marketStore.loadHistory(authStore.userId, marketStore.historyPage + 1)"
      >
        {{ tr("Fishfarm.sau") }}
      </button>
    </nav>
  </section>
</template>
