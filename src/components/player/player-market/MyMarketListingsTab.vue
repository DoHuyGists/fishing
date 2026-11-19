<script setup lang="ts">
import type { MarketListing, MarketViewMode } from "../../../types/model/market.ts";
import { computed } from "vue";
import { getFormattingLocale, t as tr } from "../../../i18n/index.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useMarketStore } from "../../../stores/player-market-store.ts";
import { formatDate, getRarityBadgeClass } from "../../../utils/marketFormatting.ts";

defineProps<{ viewMode: MarketViewMode; isCancellingListing: boolean }>();
const emit = defineEmits<{ cancelListing: [item: MarketListing] }>();
const authStore = useAuthStore();
const marketStore = useMarketStore();
const myMarketListings = computed(() => marketStore.marketListings.filter((item) => item.user_id === authStore.userId));
</script>

<template>
  <div class="py-2">
    <div v-if="!myMarketListings.length" class="py-16 text-center text-gray-400 text-xs">
      <span class="text-3xl block mb-2">📦</span>
      <div class="m-0 font-medium">{{ tr("MarketWindow.ban_chua_dang_ban_con_ca_nao_tren_cho") }}</div>
      <div class="mt-1 text-gray-400">
        {{ tr("MarketWindow.chon_ca_trong_danh_sach_tui_do_ben_phai_va_nhan_nut") }}
        <strong>{{ tr("MarketWindow.ban") }}</strong> {{ tr("MarketWindow.de_rao_ban_ca") }}
      </div>
    </div>

    <div
      v-else
      :class="viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4' : 'flex flex-col gap-2'"
    >
      <div
        v-for="item in myMarketListings"
        :key="item.id"
        class="slide-fade-in from-bottom player-content-in bg-white border border-gray-200 rounded-xl p-3 shadow-2xs"
        :class="viewMode === 'grid' ? 'flex flex-col justify-between' : 'flex items-center gap-3'"
      >
        <div>
          <div
            class="relative rounded-lg overflow-hidden bg-gray-100 mb-2 border border-gray-100"
            :class="viewMode === 'grid' ? 'w-full h-32' : 'h-20 w-28 shrink-0'"
          >
            <img
              :src="item.caught?.fish?.image || '/fish/VN/fish.jpg'"
              :alt="item.caught?.fish?.name"
              class="w-full h-full object-cover"
            />

            <span
              class="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-extrabold rounded border uppercase shadow-xs"
              :class="getRarityBadgeClass(item.caught?.fish?.rarity)"
            >
              {{ item.caught?.fish?.rarity }}
            </span>
          </div>

          <div class="flex flex-col gap-1 mb-3">
            <div class="m-0 font-bold text-sm text-[#263238] truncate">{{ item.caught?.fish?.name }}</div>
            <div class="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
              <span
                >⚖️
                {{
                  typeof item.caught?.fish?.weight === "number"
                    ? item.caught.fish.weight + " kg"
                    : item.caught?.fish?.weight
                }}</span
              >
            </div>
            <div class="text-[10px] text-gray-400">
              {{ tr("MarketWindow.ngay_dang") }} {{ formatDate(item.created_at) }}
            </div>
          </div>
        </div>

        <div class="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
          <div>
            <span class="text-[10px] text-gray-400 uppercase font-bold block">{{
              tr("MarketWindow.gia_niem_yet")
            }}</span>
            <span class="text-sm font-extrabold text-amber-600"
              >{{ item.price.toLocaleString(getFormattingLocale()) }} {{ tr("currency.cashUnit") }}</span
            >
          </div>

          <button
            type="button"
            @click="emit('cancelListing', item)"
            :disabled="isCancellingListing"
            class="px-3 py-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            {{ isCancellingListing ? tr("MarketWindow.dang_go") : tr("MarketWindow.go_ban") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
