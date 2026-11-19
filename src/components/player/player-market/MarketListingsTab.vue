<script setup lang="ts">
import type { MarketListing, MarketViewMode } from "../../../types/model/market.ts";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { getFormattingLocale, t as tr } from "../../../i18n/index.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useMarketStore } from "../../../stores/player-market-store.ts";
import { formatDate, getRarityBadgeClass } from "../../../utils/marketFormatting.ts";

const authStore = useAuthStore();
const marketStore = useMarketStore();
const {
  activeTab: activeMarketTab,
  search: marketSearch,
  rarity: marketRarity,
  sort: marketSort,
  marketListings: filteredMarketListings,
} = storeToRefs(marketStore);
const viewMode = defineModel<MarketViewMode>("viewMode", { required: true });
const emit = defineEmits<{ buy: [item: MarketListing] }>();

const groupedListings = computed(() => {
  const groups = new Map<string, MarketListing[]>();
  filteredMarketListings.value.forEach((item) => {
    const groupId = item.caught?.fish?.id || item.caught?.fish?.name || item.id;
    const group = groups.get(groupId);
    if (group) group.push(item);
    else groups.set(groupId, [item]);
  });
  return Array.from(groups, ([id, listings]) => ({ id, listings }));
});
function confirmBuy(item: MarketListing) {
  emit("buy", item);
}
</script>

<template>
  <!-- Filter & Search Toolbar (shown for 'all' tab) -->
  <div
    v-if="activeMarketTab === 'all'"
    class="mt-2 bg-white border-b border-gray-100 flex flex-wrap items-center gap-3 flex-shrink-0"
  >
    <!-- Search input -->
    <div class="relative flex-1 min-w-[200px]">
      <input
        v-model="marketSearch"
        type="text"
        :placeholder="tr('MarketWindow.tim_kiem_ca_rao_ban')"
        class="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-gray-50/70"
      />
      <svg
        class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>

    <!-- Rarity filter -->
    <div class="flex items-center gap-1 text-xs">
      <span class="text-gray-500 font-medium text-[11px]">{{ tr("MarketWindow.do_hiem") }}</span>
      <select
        v-model="marketRarity"
        class="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:outline-none"
      >
        <option value="ALL">{{ tr("Achievement.tat_ca") }}</option>
        <option value="HUYỀN THOẠI">{{ tr("WeatherSection.huyen_thoai") }}</option>
        <option value="SỬ THI">{{ tr("WeatherSection.su_thi") }}</option>
        <option value="HIẾM">{{ tr("WeatherSection.hiem") }}</option>
        <option value="THƯỜNG">{{ tr("LatestCaughtList.thuong") }}</option>
      </select>
    </div>

    <div
      class="ml-auto flex rounded-lg border border-gray-200 bg-white p-0.5"
      role="group"
      :aria-label="tr('CaughtModal.che_do_hien_thi')"
    >
      <button
        type="button"
        class="rounded-md px-2 py-1 text-[11px] font-bold"
        :class="viewMode === 'list' ? 'bg-[#153221] text-white' : 'text-gray-600 hover:bg-gray-100'"
        :aria-pressed="viewMode === 'list'"
        @click="viewMode = 'list'"
      >
        {{ tr("CaughtModal.danh_sach") }}
      </button>
      <button
        type="button"
        class="rounded-md px-2 py-1 text-[11px] font-bold"
        :class="viewMode === 'grid' ? 'bg-[#153221] text-white' : 'text-gray-600 hover:bg-gray-100'"
        :aria-pressed="viewMode === 'grid'"
        @click="viewMode = 'grid'"
      >
        {{ tr("CaughtModal.luoi") }}
      </button>
      <button
        type="button"
        class="rounded-md px-2 py-1 text-[11px] font-bold"
        :class="viewMode === 'species' ? 'bg-[#153221] text-white' : 'text-gray-600 hover:bg-gray-100'"
        :aria-pressed="viewMode === 'species'"
        @click="viewMode = 'species'"
      >
        {{ tr("CaughtModal.theo_loai") }}
      </button>
    </div>
    <!-- Sort dropdown -->
    <div class="flex items-center gap-1 text-xs">
      <span class="text-gray-500 font-medium text-[11px]">{{ tr("MarketWindow.sap_xep") }}</span>
      <select
        v-model="marketSort"
        class="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:outline-none"
      >
        <option value="newest">{{ tr("MarketWindow.moi_nhat") }}</option>
        <option value="price-asc">{{ tr("MarketWindow.gia_thap_cao") }}</option>
        <option value="price-desc">{{ tr("MarketWindow.gia_cao_thap") }}</option>
      </select>
    </div>
  </div>

  <!-- Content Area -->
  <div class="flex-1 mt-2 bg-gray-50/50">
    <!-- Tab 1: Sàn Giao Dịch -->
    <div v-if="activeMarketTab === 'all'">
      <div
        v-if="marketStore.isLoadingMarket"
        class="py-16 text-center text-gray-500 text-xs flex flex-col items-center gap-2"
      >
        <div class="w-8 h-8 border border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <span>{{ tr("MarketWindow.dang_tai_cac_ca_dang_giao_dich") }}</span>
      </div>

      <div v-else-if="!filteredMarketListings.length" class="py-16 text-center text-gray-400 text-xs">
        <span class="text-3xl block mb-2">🎣</span>
        <div class="m-0 font-medium">
          {{
            marketSearch || marketRarity !== "ALL"
              ? tr("MarketWindow.khong_tim_thay_con_ca_nao_phu_hop_voi_bo_loc")
              : tr("MarketWindow.hien_chua_co_ca_nao_duoc_dang_ban_tren_thi_truong")
          }}
        </div>
      </div>

      <div
        v-else-if="viewMode === 'species'"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
      >
        <section
          v-for="group in groupedListings"
          :key="group.id"
          class="slide-fade-in from-bottom player-content-in overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <div class="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
            <span class="truncate text-xs font-bold">{{
              group.listings[0]?.caught?.fish?.name || tr("CaughtModal.ca_chua_ro_ten")
            }}</span>
            <span class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
              >{{ group.listings.length }} {{ tr("MarketWindow.tin") }}</span
            >
          </div>
          <div class="space-y-2 p-2">
            <article
              v-for="item in group.listings"
              :key="item.id"
              class="flex items-center gap-2 rounded-lg border border-gray-100 p-2"
            >
              <img
                :src="item.caught?.fish?.image || '/fish/VN/fish.jpg'"
                :alt="item.caught?.fish?.name"
                class="h-12 w-14 shrink-0 rounded object-cover"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate text-[11px] text-gray-500">
                  {{ item.caught?.fish?.weight }} kg · {{ formatDate(item.created_at) }}
                </div>
                <div class="text-xs font-bold text-amber-700">
                  {{ item.price.toLocaleString(getFormattingLocale()) }} {{ tr("currency.cashUnit") }}
                </div>
              </div>
              <button
                v-if="item.user_id === authStore.userId"
                type="button"
                disabled
                class="rounded bg-gray-100 px-2 py-1 text-[10px] text-gray-400"
              >
                {{ tr("MarketWindow.da_dang") }}
              </button>
              <button
                v-else
                type="button"
                class="rounded bg-[#153221] px-2 py-1 text-[10px] font-bold text-white"
                @click="confirmBuy(item)"
              >
                {{ tr("InventoryModal.mua") }}
              </button>
            </article>
          </div>
        </section>
      </div>

      <div
        v-else
        :class="
          viewMode === 'grid'
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4'
            : 'flex flex-col gap-2'
        "
      >
        <div
          v-for="item in filteredMarketListings"
          :key="item.id"
          class="slide-fade-in from-bottom player-content-in bg-white border border-gray-200 hover:border-emerald-500/50 rounded-xl p-3 shadow-2xs hover:shadow-md transition-all relative group"
          :class="viewMode === 'grid' ? 'flex flex-col justify-between' : 'flex items-center gap-3'"
        >
          <div :class="viewMode === 'list' ? 'flex min-w-0 flex-1 items-center gap-3' : ''">
            <!-- Header hình cá -->
            <div
              class="relative rounded-lg overflow-hidden bg-gray-100 mb-2 border border-gray-100"
              :class="viewMode === 'grid' ? 'w-full h-32' : 'h-20 w-28 shrink-0'"
            >
              <img
                :src="item.caught?.fish?.image || '/fish/VN/fish.jpg'"
                :alt="item.caught?.fish?.name"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              <span
                class="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-extrabold rounded border uppercase shadow-xs backdrop-blur-xs"
                :class="getRarityBadgeClass(item.caught?.fish?.rarity)"
              >
                {{ item.caught?.fish?.rarity }}
              </span>

              <!-- Badge nếu là cá của bản thân -->
              <span
                v-if="item.user_id === authStore.userId"
                class="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-white font-extrabold text-[9px] rounded shadow-xs"
              >
                {{ tr("MarketWindow.ca_cua_ban") }}
              </span>
            </div>

            <!-- Thông tin chi tiết -->
            <div class="flex flex-col gap-1 mb-3" :class="viewMode === 'list' ? 'min-w-0 flex-1' : ''">
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
              <div class="text-[10px] text-gray-400 mt-0.5">
                {{ tr("MarketWindow.dang_ban") }} {{ formatDate(item.created_at) }}
              </div>
            </div>
          </div>

          <!-- Footer Giá & Nút Mua -->
          <div
            class="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 mt-auto"
            :class="viewMode === 'list' ? 'border-t-0 border-l pl-3' : ''"
          >
            <div class="flex flex-col">
              <span class="text-[10px] text-gray-400 uppercase font-bold">{{ tr("MarketWindow.gia_ban") }}</span>
              <span class="text-sm font-extrabold text-amber-600"
                >{{ item.price.toLocaleString(getFormattingLocale()) }} {{ tr("currency.cashUnit") }}</span
              >
            </div>

            <button
              v-if="item.user_id === authStore.userId"
              type="button"
              disabled
              class="px-3 py-1.5 bg-gray-100 text-gray-400 font-bold text-xs rounded-lg cursor-not-allowed"
            >
              {{ tr("MarketWindow.da_dang") }}
            </button>

            <button
              v-else
              type="button"
              @click="confirmBuy(item)"
              class="px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1"
            >
              <span>{{ tr("MarketWindow.mua_ca") }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
