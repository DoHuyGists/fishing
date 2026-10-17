<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useCaughtStore, type CaughtFish } from "../../stores/caught.ts";
import { supabaseFishRepository } from "../../data/supabaseFishRepository.ts";
import { useMarketStore } from "../../stores/market.ts";
import { useWorldStore } from "../../stores/world.ts";
import Modal from "../Modal.vue";
import FishSellConfirm from "./FishSellConfirm.vue";
import FishReleaseConfirm from "./FishReleaseConfirm.vue";
import { useToast } from "../../composables/useToast.ts";
import { formatDateTime } from "../../utils/time.ts";
const worldStore = useWorldStore();
const caughtStore = useCaughtStore();
const marketStore = useMarketStore();
const fishToRelease = ref<any | null>(null);
const searchQuery = ref("");
const selectedRarity = ref("ALL");
const groupBySpecies = ref(false);
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
  Math.max(1, Math.ceil((groupBySpecies.value ? groupedCaughtFishes.value.length : filteredCaughtFishes.value.length) / pageSize)),
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

watch([searchQuery, selectedRarity, groupBySpecies], () => {
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
    toast.success("Đã đăng bán", { title: "Thành công", position: "bottom" });
  } catch (err: any) {
    toast.error("Lỗi khi đăng bán cá", { title: "Không thành công", position: "bottom" });
  } finally {
    isSelling.value = false;
  }
}

function getRarityBadgeClass(rarity: string | null | undefined) {
  switch (rarity) {
    case "Sách Ä‘ỏ":
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
    toast.success("Đã thả", { title: "Thành công", position: "bottom" });
  } catch (err) {
    toast.success("Lỗi khi thả", { title: "Không thành công", position: "bottom" });
  } finally {
    isReleasing.value = false;
  }
}

</script>
<template>
  <Modal
    class="caught-list-modal"
    title="Túi cá"
    sub-title="Những loài cá bạn sẵn được"
    :on-refresh="caughtStore.loadCaughtFishes"
  >
    <section class="h-full min-h-0 text-[#263238] flex flex-col overflow-hidden">
      <!-- Header  -->
      <div class="flex items-center justify-between pb-3">
        <div class="flex items-center gap-2">
          <h2 class="m-0 text-base font-bold text-[#263238]">Tổng số cá</h2>
          <span class="px-2 py-0.5 rounded-full bg-[#153221] text-white text-[11px] font-extrabold shadow-xs">
            {{ caughtStore.caughtFishes.length }}
          </span>
        </div>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer"
          :class="
            groupBySpecies
              ? 'bg-[#153221] text-white border-[#153221]'
              : 'bg-white text-[#153221] border-emerald-900/20 hover:bg-emerald-50'
          "
          :aria-pressed="groupBySpecies"
          @click="groupBySpecies = !groupBySpecies"
        >
          {{ groupBySpecies ? "Đang gom theo loài" : "Gom theo loài" }}
        </button>
      </div>

      <!-- Công cụ tìm kiếm -->
      <div class="flex flex-col gap-2 mb-3">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm theo tên cá..."
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
            Tất cả
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
        class="h-0 grow overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 content-start"
      >
        <div v-if="caughtStore.isLoadingCaught" class="col-span-full text-center text-xs text-gray-500">
          Đang tải danh sách cá...
        </div>
        <div v-else-if="!filteredCaughtFishes.length" class="col-span-full py-12 text-center text-xs text-gray-400">
          {{
            searchQuery || selectedRarity !== "ALL"
              ? "Không tìm thấy cá phù hợp"
              : "Chưa có con cá nào trong bộ sưu tập"
          }}
        </div>
        <template v-else-if="groupBySpecies">
          <article
            v-for="group in paginatedFishGroups"
            :key="group.id"
            class="min-w-0 overflow-hidden h-fit border border-gray-200 hover:border-emerald-300 rounded-xl bg-gray-50/70 transition-all shadow-sm"
          >
            <img
              :src="group.fishes[0].species?.image || '/fish/VN/fish.jpg'"
              :alt="group.fishes[0].species?.name || 'Cá'"
              class="w-full h-36 object-cover border-b border-gray-200 bg-gray-200"
            />
            <div class="p-2">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <h3 class="m-0 truncate font-bold text-xs text-[#263238]">
                    {{ group.fishes[0].species?.name || "Cá chưa rõ tên" }}
                  </h3>
                  <span
                    v-if="group.fishes[0].species?.rarity"
                    class="inline-block mt-1 px-1.5 py-1 text-[9px] font-extrabold rounded border uppercase"
                    :class="getRarityBadgeClass(group.fishes[0].species?.rarity)"
                  >
                    {{ group.fishes[0].species?.rarity }}
                  </span>
                </div>
                <span class="shrink-0 px-2 py-1 rounded-full bg-[#153221] text-white text-[10px] font-extrabold">
                  {{ group.fishes.length }} con
                </span>
              </div>
              <button
                type="button"
                class="mt-2 w-full px-2 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors cursor-pointer"
                :aria-expanded="expandedSpecies === group.id"
                @click="expandedSpecies = expandedSpecies === group.id ? null : group.id"
              >
                {{ expandedSpecies === group.id ? "Ẩn chi tiết" : "Xem từng con" }}
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
                    type="button"
                    class="mt-1 cursor-pointer text-left hover:underline"
                    @click="worldStore.handleMoveToArea(fish.origin)"
                  >
                    {{ fish.origin.country }} - {{ fish.origin.name }}
                  </button>
                  <div class="mt-2 flex gap-2">
                    <button
                      type="button"
                      class="px-2 py-1 border border-emerald-200 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold transition-colors cursor-pointer"
                      title="Đăng bán"
                      @click="openSellConfirm(fish)"
                    >
                      Bán
                    </button>
                    <button
                      type="button"
                      class="px-2 py-1 border border-red-200 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold transition-colors cursor-pointer"
                      title="Thả cá về lại tự nhiên"
                      @click="openReleaseConfirm(fish)"
                    >
                      Thả
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
          class="min-w-0 p-2 border border-gray-200 hover:border-emerald-300 rounded-xl bg-gray-50/70 hover:bg-emerald-50/30 transition-all flex flex-col gap-2 shadow-sm"
        >
          <img
            :src="item.species?.image || '/fish/VN/fish.jpg'"
            :alt="item.species?.name"
            class="w-full h-36 rounded-lg object-cover border border-gray-200 bg-gray-200"
          />
          <div class="flex flex-1 min-w-0 flex-col gap-2">
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
                  @click="worldStore.handleMoveToArea(item.origin)"
                  class="text-xs mt-1 cursor-pointer hover:underline"
                >
                  {{ item.origin.country }} - {{ item.origin.name }}
                </div>
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                type="button"
                class="px-2 py-1.5 border border-emerald-200 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors cursor-pointer"
                title="Đăng bán"
                @click="openSellConfirm(item)"
              >
                Bán
              </button>
              <button
                type="button"
                class="px-2 py-1.5 border border-red-200 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition-colors cursor-pointer"
                title="Thả cá về lại tự nhiên"
                @click="openReleaseConfirm(item)"
              >
                Thả
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="(groupBySpecies ? groupedCaughtFishes.length : filteredCaughtFishes.length) > pageSize"
        class="flex items-center justify-between gap-3 border-t border-gray-200 pt-3 mt-3 text-xs"
      >
        <span class="text-gray-500"
          >Trang {{ currentPage }} / {{ pageCount }} ({{
            groupBySpecies ? `${groupedCaughtFishes.length} loài` : `${filteredCaughtFishes.length} cá`
          }})</span
        >
        <div class="flex gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            Trước
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
            :disabled="currentPage === pageCount"
            @click="currentPage++"
          >
            Sau
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
