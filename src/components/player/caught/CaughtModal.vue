<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { computed, onMounted, ref, watch } from "vue";
import { useCaughtStore, type CaughtFish } from "../../../stores/caught.ts";
import { supabaseFishRepository } from "../../../data/supabaseFishRepository.ts";
import { useMarketStore } from "../../../stores/market.ts";
import { useWorldStore } from "../../../stores/worldMap.ts";
import Modal from "../../shared/Modal.vue";
import FishSellConfirm from "./FishSellConfirm.vue";
import FishReleaseConfirm from "./FishReleaseConfirm.vue";
import { useToast } from "../../../composables/useToast.ts";
import { formatDateTime } from "../../../utils/time.ts";
const worldStore = useWorldStore();
const caughtStore = useCaughtStore();
onMounted(() => { void caughtStore.loadCaughtFishes(); });
const marketStore = useMarketStore();
const fishToRelease = ref<any | null>(null);
const searchQuery = ref("");
const selectedRarity = ref("ALL");
const viewMode = ref<"grid" | "list" | "species">("species");
const expandedSpecies = ref<string | null>(null);
const currentPage = ref(1);
const pageSize = 12;
const groupedCaughtFishes = computed(() => {
  const groups = new Map<string, CaughtFish[]>();
  filteredCaughtFishes.value.forEach((fish) => {
    const groupId = fish.species?.id || fish.species?.name || fish.id;
    const group = groups.get(groupId);
    if (group) {
      group.push(fish);
    } else {
      groups.set(groupId, [fish]);
    }
  });
  return Array.from(groups, ([id, fishes]) => ({ id, fishes }));
});
const pageCount = computed(() =>
  Math.max(
    1,
    Math.ceil(
      (viewMode.value === "species" ? groupedCaughtFishes.value.length : filteredCaughtFishes.value.length) / pageSize,
    ),
  ),
);
const paginatedCaughtFishes = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredCaughtFishes.value.slice(start, start + pageSize);
});
const paginatedFishGroups = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return groupedCaughtFishes.value.slice(start, start + pageSize);
});
const isReleasing = ref(false);
const fishToSell = ref<any | null>(null);
const isSelling = ref(false);
const sellError = ref("");
const toast = useToast();

const filteredCaughtFishes = computed(() => {
  return caughtStore.caughtFishes.filter((item) => {
    const nameMatch =
      !searchQuery.value || item.species?.name?.toLowerCase().includes(searchQuery.value.toLowerCase().trim());
    const rarityMatch = selectedRarity.value === "ALL" || item.species?.rarity === selectedRarity.value;
    return nameMatch && rarityMatch;
  });
});

watch([searchQuery, selectedRarity, viewMode], () => {
  currentPage.value = 1;
  expandedSpecies.value = null;
});
watch(pageCount, (count) => {
  if (currentPage.value > count) currentPage.value = count;
});

const rarityOptions = computed(() => {
  const set = new Set<string>();
  caughtStore.caughtFishes.forEach((item) => {
    if (item.species?.rarity) set.add(item.species.rarity);
  });
  return Array.from(set);
});

function openSellConfirm(item: any) {
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
    await supabaseFishRepository.listFishOnMarket(fishToSell.value.id, priceNum);
    caughtStore.caughtFishes = caughtStore.caughtFishes.filter((f) => f.id !== fishToSell.value.id);
    await marketStore.loadMarketListings();
    cancelSell();
    toast.success(tr('CaughtModal.da_dang_ban'), { get title() { return tr('AttendanceModal.thanh_cong'); }, position: "bottom" });
  } catch (err: any) {
    toast.error(tr('CaughtModal.loi_khi_dang_ban_ca'), { get title() { return tr('CaughtModal.khong_thanh_cong'); }, position: "bottom" });
  } finally {
    isSelling.value = false;
  }
}

function getRarityBadgeClass(rarity: string | null | undefined) {
  switch (rarity) {
    case "Sách đỏ":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "Quý hiếm":
      return "bg-purple-100 text-purple-800 border-purple-300";
    case "Khó tìm":
      return "bg-blue-100 text-blue-800 border-blue-300";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

function openReleaseConfirm(item: any) {
  fishToRelease.value = item;
}

function cancelRelease() {
  fishToRelease.value = null;
}

async function handleRelease() {
  if (!fishToRelease.value) return;
  isReleasing.value = true;
  try {
    await supabaseFishRepository.deleteCaughtFish(fishToRelease.value.id);
    caughtStore.caughtFishes = caughtStore.caughtFishes.filter((f) => f.id !== fishToRelease.value.id);
    fishToRelease.value = null;
    toast.success(tr('CaughtModal.da_tha'), { get title() { return tr('AttendanceModal.thanh_cong'); }, position: "bottom" });
  } catch (err) {
    toast.error(tr('CaughtModal.loi_khi_tha_ca'), { get title() { return tr('CaughtModal.khong_thanh_cong'); }, position: "bottom" });
  } finally {
    isReleasing.value = false;
  }
}
</script>
<template>
  <Modal
    class="caught-list-modal"
    :title="tr('CaughtModal.tui_ca')"
    :sub-title="tr('CaughtModal.nhung_loai_ca_ban_san_duoc')"
    :on-refresh="caughtStore.loadCaughtFishes"
  >
    <section class="h-full min-h-0 text-[#263238] flex flex-col overflow-hidden">
      <!-- Header  -->
      <div class="flex items-center justify-between gap-2 pb-3">
        <div class="flex items-center gap-2">
          <div class="m-0 text-base font-bold text-[#263238]">{{ tr('CaughtModal.tong_so_ca') }}</div>
          <span class="px-2 py-0.5 rounded-full bg-[#153221] text-white text-[11px] font-extrabold shadow-xs">
            {{ caughtStore.caughtFishes.length }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex rounded-lg border border-gray-200 bg-white p-0.5" role="group" :aria-label="tr('CaughtModal.che_do_hien_thi')">
            <button
              type="button"
              class="rounded-md px-2 py-1.5 text-xs font-bold transition-colors cursor-pointer"
              :class="viewMode === 'grid' ? 'bg-[#153221] text-white' : 'text-gray-600 hover:bg-gray-100'"
              :aria-pressed="viewMode === 'grid'"
              :aria-label="tr('CaughtModal.hien_thi_dang_luoi')"
              @click="viewMode = 'grid'"
            >
              {{ tr('CaughtModal.luoi') }}
            </button>
            <button
              type="button"
              class="rounded-md px-2 py-1.5 text-xs font-bold transition-colors cursor-pointer"
              :class="viewMode === 'list' ? 'bg-[#153221] text-white' : 'text-gray-600 hover:bg-gray-100'"
              :aria-pressed="viewMode === 'list'"
              :aria-label="tr('CaughtModal.hien_thi_dang_danh_sach')"
              @click="viewMode = 'list'"
            >
              {{ tr('CaughtModal.danh_sach') }}
            </button>
            <button
              type="button"
              class="rounded-md px-2 py-1.5 text-xs font-bold transition-colors cursor-pointer"
              :class="viewMode === 'species' ? 'bg-[#153221] text-white' : 'text-gray-600 hover:bg-gray-100'"
              :aria-pressed="viewMode === 'species'"
              :aria-label="tr('CaughtModal.gom_theo_loai')"
              @click="viewMode = 'species'"
            >
              {{ tr('CaughtModal.theo_loai') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Công cụ tìm kiếm -->
      <div class="flex flex-col gap-2 mb-3">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="tr('CaughtModal.tim_theo_ten_ca')"
            class="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-gray-50/80"
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

        <div
          v-if="rarityOptions.length"
          class="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] [scrollbar-width:none]"
        >
          <button
            type="button"
            class="px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer whitespace-nowrap"
            :class="
              selectedRarity === 'ALL'
                ? 'bg-[#153221] text-white border-gray-300 font-bold'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
            "
            @click="selectedRarity = 'ALL'"
          >
            {{ tr('Achievement.tat_ca') }}
          </button>
          <button
            v-for="rarity in rarityOptions"
            :key="rarity"
            type="button"
            class="px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer whitespace-nowrap"
            :class="
              selectedRarity === rarity
                ? 'bg-[#153221] text-white border-gray-300 font-bold'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
            "
            @click="selectedRarity = rarity"
          >
            {{ rarity }}
          </button>
        </div>
      </div>

      <!-- Danh sách thẻ cá -->
      <div
        class="h-0 grow overflow-y-auto pr-1 gap-3 content-start"
        :class="viewMode !== 'list' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6' : 'flex flex-col'"
      >
        <div v-if="caughtStore.isLoadingCaught" class="col-span-full text-center text-xs text-gray-500">
          {{ tr('CaughtModal.dang_tai_danh_sach_ca') }}
        </div>
        <div v-else-if="!filteredCaughtFishes.length" class="col-span-full py-12 text-center text-xs text-gray-400">
          {{
            searchQuery || selectedRarity !== "ALL"
              ? tr('CaughtModal.khong_tim_thay_ca_phu_hop')
              : tr('CaughtModal.chua_co_con_ca_nao_trong_bo_suu_tap')
          }}
        </div>
        <template v-else-if="viewMode === 'species'">
          <article
            v-for="group in paginatedFishGroups"
            :key="group.id"
            class="min-w-0 overflow-hidden h-fit border border-gray-200 hover:border-emerald-300 rounded-xl bg-gray-50/70 transition-all shadow-sm"
          >
            <img
              :src="group.fishes[0].species?.image || '/fish/VN/fish.jpg'"
              :alt="group.fishes[0].species?.name || tr('CaughtModal.ca')"
              class="object-cover bg-gray-200 w-full h-36 border-b border-gray-200"
            />
            <div class="min-w-0 flex-1 p-2">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="m-0 truncate font-bold text-xs text-[#263238]">
                    {{ group.fishes[0].species?.name || tr('CaughtModal.ca_chua_ro_ten') }}
                  </div>
                  <span
                    v-if="group.fishes[0].species?.rarity"
                    class="inline-block mt-1 px-1.5 py-1 text-[9px] font-extrabold rounded border uppercase"
                    :class="getRarityBadgeClass(group.fishes[0].species?.rarity)"
                  >
                    {{ group.fishes[0].species?.rarity }}
                  </span>
                </div>
                <span class="shrink-0 px-2 py-1 rounded-full bg-[#153221] text-white text-[10px] font-extrabold">
                  {{ group.fishes.length }} {{ tr('UserProfile.con') }}
                </span>
              </div>
              <button
                type="button"
                class="mt-2 w-full px-2 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors cursor-pointer"
                :aria-expanded="expandedSpecies === group.id"
                @click="expandedSpecies = expandedSpecies === group.id ? null : group.id"
              >
                {{ expandedSpecies === group.id ? tr('CaughtModal.an_chi_tiet') : tr('CaughtModal.xem_tung_con') }}
              </button>
              <div
                v-if="expandedSpecies === group.id"
                class="mt-2 space-y-2 border-t border-gray-200 pt-2 overflow-y-scroll h-60"
              >
                <div
                  v-for="fish in group.fishes"
                  :key="fish.id"
                  class="rounded-lg bg-white p-2 text-[10px] text-gray-600"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-semibold text-gray-800">{{ fish.weight }} kg · {{ fish.variant_type }}</span>
                    <span class="shrink-0">{{ formatDateTime(fish.created_at) }}</span>
                  </div>
                  <button
                    v-if="fish.origin"
                    type="button"
                    class="mt-1 cursor-pointer text-left hover:underline"
                    @click="worldStore.handleMoveToArea(fish.origin)"
                  >
                    {{ fish.origin.country }} - {{ fish.origin.name }}
                  </button>
                  <span v-else class="mt-1 block text-emerald-700">{{ tr('CaughtModal.nguon_nuoi_tai_ao') }}</span>
                  <div class="mt-2 flex gap-2">
                    <button
                      type="button"
                      class="px-2 py-1 border border-emerald-200 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold transition-colors cursor-pointer"
                      :title="tr('CaughtModal.dang_ban')"
                      @click="openSellConfirm(fish)"
                    >
                      {{ tr('Fishfarm.ban') }}
                    </button>
                    <button
                      type="button"
                      class="px-2 py-1 border border-red-200 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold transition-colors cursor-pointer"
                      :title="tr('CaughtModal.tha_ca_ve_lai_tu_nhien')"
                      @click="openReleaseConfirm(fish)"
                    >
                      {{ tr('Fishfarm.tha') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </template>
        <div
          v-else
          v-for="item in paginatedCaughtFishes"
          :key="item.id"
          class="min-w-0 p-2 border border-gray-200 hover:border-emerald-300 rounded-xl bg-gray-50/70 hover:bg-emerald-50/30 transition-all shadow-sm"
          :class="viewMode === 'grid' ? 'flex flex-col gap-2' : 'flex items-center gap-3'"
        >
          <img
            :src="item.species?.image || '/fish/VN/fish.jpg'"
            :alt="item.species?.name"
            class="rounded-lg object-cover border border-gray-200 bg-gray-200"
            :class="viewMode === 'grid' ? 'w-full h-36' : 'w-fit h-20 shrink-0'"
          />
          <div
            class="flex flex-1 min-w-0 gap-2"
            :class="viewMode === 'grid' ? 'flex-col' : 'items-center justify-between'"
          >
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
              <div class="flex items-center justify-between gap-1">
                <span class="font-bold text-xs truncate text-[#263238]">{{ item.species?.name }}</span>
              </div>
              <div class="flex items-center gap-2 text-[11px] text-gray-600">
                <span>{{
                  typeof item.species?.weight === "number" ? item.species.weight + " kg" : item.species?.weight
                }}</span>
              </div>
              <div class="flex items-center justify-between text-[10px] text-gray-400">
                <span class="shrink-0 ml-1">{{ formatDateTime(item.created_at!) }}</span>
              </div>
              <div>
                <span
                  class="px-1.5 py-1 text-[9px] font-extrabold rounded border shrink-0 uppercase"
                  :class="getRarityBadgeClass(item.species?.rarity)"
                >
                  {{ item.species?.rarity }}
                </span>
                <span class="text-xs px-1.5 py-1">{{ item.variant_type }}</span>
                <div
                  v-if="item.origin"
                  @click="worldStore.handleMoveToArea(item.origin)"
                  class="text-xs mt-1 cursor-pointer hover:underline"
                >
                  {{ item.origin.country }} - {{ item.origin.name }}
                </div>
                <div v-else class="mt-1 text-xs text-emerald-700">{{ tr('CaughtModal.nguon_nuoi_tai_ao') }}</div>
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                type="button"
                class="px-2 py-1.5 border border-emerald-200 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors cursor-pointer"
                :title="tr('CaughtModal.dang_ban')"
                @click="openSellConfirm(item)"
              >
                {{ tr('Fishfarm.ban') }}
              </button>
              <button
                type="button"
                class="px-2 py-1.5 border border-red-200 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition-colors cursor-pointer"
                :title="tr('CaughtModal.tha_ca_ve_lai_tu_nhien')"
                @click="openReleaseConfirm(item)"
              >
                {{ tr('Fishfarm.tha') }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="(viewMode === 'species' ? groupedCaughtFishes.length : filteredCaughtFishes.length) > pageSize"
        class="flex items-center justify-between gap-3 border-t border-gray-200 pt-3 mt-3 text-xs"
      >
        <span class="text-gray-500"
          >{{ tr('CaughtModal.trang') }} {{ currentPage }} / {{ pageCount }} ({{
            viewMode === "species" ? tr('CaughtModal.value0_loai', { value0: groupedCaughtFishes.length }) : tr('CaughtModal.value0_ca', { value0: filteredCaughtFishes.length })
          }})</span
        >
        <div class="flex gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            {{ tr('Fishfarm.truoc') }}
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
            :disabled="currentPage === pageCount"
            @click="currentPage++"
          >
            {{ tr('Fishfarm.sau') }}
          </button>
        </div>
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
