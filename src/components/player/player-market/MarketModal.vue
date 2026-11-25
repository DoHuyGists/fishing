<script lang="ts" setup>
import type { MarketListing, MarketViewMode } from "../../../types/model/market.ts";
import { t as tr } from "../../../i18n/index.ts";

import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useCurrencyStore } from "../../../stores/player-currency-store.ts";
import { supabaseMarketRepository } from "../../../data/supabaseMarketRepository.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useMarketStore } from "../../../stores/player-market-store.ts";
import { useCaughtStore } from "../../../stores/player-caught-store.ts";
import MarketListingsTab from "./MarketListingsTab.vue";
import MyMarketListingsTab from "./MyMarketListingsTab.vue";
import MarketHistoryTab from "./MarketHistoryTab.vue";
import Modal from "../../shared/Modal.vue";
import CapacityUsage from "../../shared/CapacityUsage.vue";
import { useUserProfileStore } from "../../../stores/player-user-profile-store";
import Tab from "../../shared/Tab.vue";
import PaymentConfirmation from "../../shared/PaymentConfirmation.vue";
import { useToast } from "../../../composables/useToast.ts";

const authStore = useAuthStore();
const currencyStore = useCurrencyStore();

const viewMode = ref<MarketViewMode>("grid");
const toast = useToast();

const itemToBuy = ref<MarketListing | null>(null);
const isBuying = ref(false);
const isCancellingListing = ref(false);
const marketStore = useMarketStore();
const profile = useUserProfileStore();
const {
  activeTab: activeMarketTab,
  search: marketSearch,
  rarity: marketRarity,
  sort: marketSort,
} = storeToRefs(marketStore);
const caughtStore = useCaughtStore();
const LISTED_PRICE = 500;
const emit = defineEmits(["close"]);
const sellingUsage = computed(() => {
  if (marketStore.sellingCount === null || !profile.profile || profile.marketSellSlots <= 0) return null;
  return Math.min(100, Math.max(0, marketStore.sellingCount / profile.marketSellSlots * 100));
});
const balanceFee = computed(() => {
  if (!itemToBuy.value) return 0;
  const price = Number(itemToBuy.value.price);
  if (price >= 1000) {
    const balanceFactor = Math.floor(price / 1000.0) * 0.01;
    return Math.floor(price * balanceFactor);
  } else {
    return 0;
  }
});

const marketTabs = computed(() => [
  {
    key: "all",
    get label() {
      return tr("MarketWindow.san_giao_dich");
    },
  },
  {
    key: "my",
    badge: marketStore.sellingCount ?? undefined,
    get label() {
      return tr("MarketWindow.ca_cua_toi_dang_ban");
    },
  },
  {
    key: "history",
    get label() {
      return tr("MarketWindow.lich_su_mua_ban");
    },
  },
]);

function confirmBuy(item: MarketListing) {
  itemToBuy.value = item;
}

function cancelBuy() {
  if (isBuying.value) return;
  itemToBuy.value = null;
}

async function handleBuyFish() {
  if (
    !itemToBuy.value ||
    isBuying.value ||
    currencyStore.cash < LISTED_PRICE + balanceFee.value + itemToBuy.value.price
  )
    return;
  if (!authStore.userId) {
    toast.error(tr("MarketWindow.ban_chua_dang_nhap"), {
      get title() {
        return tr("MarketWindow.khong_the_mua_ca");
      },
    });
    return;
  }

  isBuying.value = true;
  try {
    const fishName = itemToBuy.value.caught?.fish?.name || tr("Fishfarm.ca_2");
    await supabaseMarketRepository.buyFish(itemToBuy.value.id);
    await Promise.all([
      marketStore.loadMarketListings(true),
      currencyStore.fetchCurrency(),
      caughtStore.loadCaughtFishes(),
    ]);
    itemToBuy.value = null;
    toast.success(tr("MarketWindow.mua_value0_thanh_cong", { value0: fishName }), {
      get title() {
        return tr("FishingPassPurchaseModal.giao_dich_thanh_cong");
      },
    });
  } catch (err: any) {
    void marketStore.loadMarketListings(true);
    console.error("Lỗi khi mua cá:", err);
    toast.error(err?.message || tr("MarketWindow.khong_the_mua_ca_vui_long_thu_lai"), {
      get title() {
        return tr("MarketWindow.mua_ca_that_bai");
      },
    });
  } finally {
    isBuying.value = false;
  }
}

async function handleCancelListing(item: MarketListing) {
  if (!item.caught?.id) return;
  isCancellingListing.value = true;
  try {
    await supabaseMarketRepository.cancelListing(item.id);
    await marketStore.loadMarketListings();
    await caughtStore.loadCaughtFishes();
    toast.success(tr("MarketWindow.da_go_tin_ban_ca"), {
      get title() {
        return tr("AttendanceModal.thanh_cong");
      },
    });
  } catch (err) {
    console.error("Lỗi khi gỡ cá:", err);
    toast.error(tr("MarketWindow.ban_chua_dang_nhap"), {
      get title() {
        return tr("MarketWindow.khong_the_mua_ca");
      },
    });
  } finally {
    isCancellingListing.value = false;
  }
}
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch([marketSearch, marketRarity, marketSort], () => {
  clearTimeout(searchTimer);
  marketStore.listingPage = 1;
  searchTimer = setTimeout(() => {
    void marketStore.loadVisible();
  }, 300);
});
watch(activeMarketTab, () => {
  clearTimeout(searchTimer);
  marketStore.listingPage = 1;
  void marketStore.loadVisible();
});
watch(
  () => marketStore.listingPage,
  () => {
    void marketStore.loadVisible();
  },
);
onMounted(() => {
  marketStore.startRefreshing(authStore.userId);
  void currencyStore.fetchCurrency();
});
onUnmounted(() => {
  clearTimeout(searchTimer);
  marketStore.stopRefreshing();
});
</script>

<template>
  <Modal
    class="market-window"
    :title="tr('MarketWindow.cho_ca')"
    :show-count-data="activeMarketTab !== 'history'"
    :on-refresh="() => marketStore.loadVisible()"
  >
    <div class="mx-auto w-full max-w-[1600px] px-1 py-3 sm:px-4 lg:px-6">
      <div v-if="marketStore.error" role="alert" class="mb-4 rounded-xl border border-danger/30 bg-white p-4 text-sm text-danger">
        {{ marketStore.error }}
      </div>
      <div class="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white px-4 py-4 sm:px-5">
        <div class="flex items-center gap-3">
          <span aria-hidden="true" class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-accent">
            <svg class="size-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M3 10h18M4 10v10h16V10M3 10l2-6h14l2 6M9 20v-6h6v6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </span>
          <CapacityUsage :label="tr('Capacity.market')" :used="marketStore.sellingCount" :capacity="profile.profile ? profile.marketSellSlots : null" />
        </div>
        <div v-if="sellingUsage !== null" class="h-2 w-full overflow-hidden rounded-full bg-primary sm:w-44" aria-hidden="true">
          <div class="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none" :style="{ width: `${sellingUsage}%` }"></div>
        </div>
      </div>
      <Tab v-model="activeMarketTab" class="market-tabs" :tabs="marketTabs" :aria-label="tr('MarketWindow.cho_ca')" lazy>
        <template #all>
          <MarketListingsTab v-model:view-mode="viewMode" @buy="confirmBuy" />
        </template>
        <template #my>
          <MyMarketListingsTab
            :view-mode="viewMode"
            :is-cancelling-listing="isCancellingListing"
            @cancel-listing="handleCancelListing"
          />
        </template>
        <template #history>
          <MarketHistoryTab />
        </template>
      </Tab>
      <nav
        v-if="activeMarketTab !== 'history'"
        :aria-label="tr('MarketWindow.cho_ca')"
        class="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3 text-sm"
      >
        <button
          type="button"
          :disabled="marketStore.isLoadingMarket || marketStore.listingPage <= 1"
          class="min-h-11 rounded-xl border border-border px-4 font-medium transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          @click="marketStore.listingPage--"
        >
          {{ tr("Fishfarm.truoc") }}
        </button>
        <span>{{ tr("CaughtModal.trang") }} {{ marketStore.listingPage }}</span>
        <button
          type="button"
          :disabled="marketStore.isLoadingMarket || !marketStore.listingHasNext"
          class="min-h-11 rounded-xl border border-border px-4 font-medium transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          @click="marketStore.listingPage++"
        >
          {{ tr("Fishfarm.sau") }}
        </button>
      </nav>
    </div>
  </Modal>
  <PaymentConfirmation
    v-if="itemToBuy"
    :title="tr('MarketWindow.xac_nhan_mua_ca')"
    :balance="currencyStore.cash"
    :total="LISTED_PRICE + balanceFee + itemToBuy.price"
    :costs="[
      { label: tr('MarketWindow.gia'), amount: itemToBuy.price },
      { label: tr('FishSellConfirm.phi_niem_yet_thi_truong'), amount: LISTED_PRICE },
      { label: tr('FishSellConfirm.phi_can_bang_thi_truong'), amount: balanceFee },
    ]"
    :confirm-text="tr('InventoryModal.mua')"
    :busy="isBuying"
    @cancel="cancelBuy"
    @confirm="handleBuyFish"
  >
    <div class="flex items-center gap-3 rounded-xl border border-border-default bg-surface p-3">
      <img
        :src="itemToBuy.caught?.fish?.image || '/fish/VN/fish.jpg'"
        :alt="itemToBuy.caught?.fish?.name || ''"
        class="h-12 rounded-lg object-cover"
      />
      <div class="min-w-0 text-sm">
        <div class="truncate font-bold">{{ itemToBuy.caught?.fish?.name }}</div>
        <div>{{ itemToBuy.caught?.fish?.weight }} kg</div>
      </div>
    </div>
  </PaymentConfirmation>
</template>

<style scoped>
.market-tabs { height: auto; }
.market-tabs :deep([role="tabpanel"]) { height: auto; }
</style>
