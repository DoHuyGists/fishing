<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { t as tr } from "../../../i18n";
import { useCaughtStore } from "../../../stores/player-caught-store";
import { useMarketStore } from "../../../stores/player-market-store";
import type { CaughtFish, CaughtViewMode } from "../../../types/model/caughtFish";
import { useCaughtCollection } from "../../../composables/useCaughtCollection";
import { useToast } from "../../../composables/useToast";
import Modal from "../../shared/Modal.vue";
import Tab from "../../shared/Tab.vue";
import Pagination from "../../shared/Pagination.vue";
import CaughtFilters from "./CaughtFilters.vue";
import CaughtFishList from "./CaughtFishList.vue";
import FishSellConfirm from "./FishSellConfirm.vue";
import FishReleaseConfirm from "./FishReleaseConfirm.vue";

const caughtStore = useCaughtStore();
const marketStore = useMarketStore();
const toast = useToast();
const collection = useCaughtCollection();
const {
  viewMode, currentPage, pageSize, expandedSpecies, rarityOptions, originOptions,
  hasActiveFilters, invalidWeightRange, filteredFishes, paginatedFishes, paginatedGroups, total,
} = collection;
const viewTabs = computed<{ key: CaughtViewMode; label: string }[]>(() => [
  { key: "species", label: tr("CaughtModal.theo_loai") },
  { key: "grid", label: tr("CaughtModal.luoi") },
  { key: "list", label: tr("CaughtModal.danh_sach") },
]);
const fishToRelease = ref<CaughtFish | null>(null);
const isReleasing = ref(false);
const fishToSell = ref<CaughtFish | null>(null);
const isSelling = ref(false);
const sellError = ref("");
onMounted(() => { void caughtStore.loadCaughtFishes(); });

function openSellConfirm(item: CaughtFish) {
  fishToSell.value = item;
  sellError.value = "";
}

function cancelSell() {
  fishToSell.value = null;
  sellError.value = "";
}

async function handleSell(priceNum: number) {
  if (!fishToSell.value) return;

  isSelling.value = true;
  sellError.value = "";

  try {
    if (!await caughtStore.listFishForSale(fishToSell.value.id, priceNum)) return;
    await marketStore.loadMarketListings();
    cancelSell();
    toast.success(tr("CaughtModal.da_dang_ban"), {
      get title() {
        return tr("AttendanceModal.thanh_cong");
      },
    });
  } catch (err: any) {
    toast.error(tr("CaughtModal.loi_khi_dang_ban_ca"), {
      get title() {
        return tr("CaughtModal.khong_thanh_cong");
      },
    });
  } finally {
    isSelling.value = false;
  }
}

function openReleaseConfirm(item: CaughtFish) {
  fishToRelease.value = item;
}

function cancelRelease() {
  fishToRelease.value = null;
}

async function handleRelease() {
  if (!fishToRelease.value) return;
  isReleasing.value = true;
  try {
    if (!await caughtStore.releaseFish(fishToRelease.value.id)) return;
    fishToRelease.value = null;
    toast.success(tr("CaughtModal.da_tha"), {
      get title() {
        return tr("AttendanceModal.thanh_cong");
      },
    });
  } catch (err) {
    toast.error(tr("CaughtModal.loi_khi_tha_ca"), {
      get title() {
        return tr("CaughtModal.khong_thanh_cong");
      },
    });
  } finally {
    isReleasing.value = false;
  }
}
</script>

<template>
  <Modal class="caught-list-modal" :title="tr('CaughtModal.tui_ca')" :on-refresh="caughtStore.loadCaughtFishes">
    <section class="flex h-full min-h-0 flex-col gap-3 overflow-hidden text-content md:flex-row">
      <CaughtFilters
        v-model="collection.filters"
        :rarities="rarityOptions"
        :origins="originOptions"
        :active="hasActiveFilters"
        :invalid-weight-range="invalidWeightRange"
        @reset="collection.resetFilters"
      />
      <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div class="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2 text-sm font-bold">
            <span>{{ tr("CaughtModal.tong_so_ca") }}</span>
            <span class="rounded-full bg-content-strong px-2 py-0.5 text-xs text-white">{{ caughtStore.caughtFishes.length }}</span>
          </div>
          <span v-if="hasActiveFilters" class="text-xs" aria-live="polite">{{ tr("CaughtModal.filtered_count", { count: filteredFishes.length }) }}</span>
        </div>
        <Tab v-model="viewMode" :tabs="viewTabs" contained lazy :aria-label="tr('CaughtModal.che_do_hien_thi')" class="min-h-0 flex-1">
          <template v-for="tab in viewTabs" :key="tab.key" #[tab.key]>
            <CaughtFishList
              v-model:expanded-species="expandedSpecies"
              class="pt-3"
              :view-mode="tab.key"
              :fishes="paginatedFishes"
              :groups="paginatedGroups"
              :total="filteredFishes.length"
              :loading="caughtStore.isLoadingCaught"
              :has-active-filters="hasActiveFilters"
              @sell="openSellConfirm"
              @release="openReleaseConfirm"
            />
          </template>
        </Tab>
        <Pagination :page="currentPage" :total="total" :page-size="pageSize" :loading="caughtStore.isLoadingCaught" @change="currentPage = $event" />
      </div>
    </section>
  </Modal>
  <FishReleaseConfirm
    :fish="fishToRelease"
    :is-loading="isReleasing"
    @cancel="cancelRelease"
    @confirm="handleRelease"
  />
  <FishSellConfirm
    :fish="fishToSell"
    :is-loading="isSelling"
    :error="sellError"
    @cancel="cancelSell"
    @confirm="handleSell"
  />
</template>
