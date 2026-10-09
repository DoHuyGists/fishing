<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useCaughtStore } from "../../stores/caught";
import { useAuthStore } from "../../stores/auth";
import { supabaseFishRepository } from "../../data/supabaseFishRepository";
import { useMarketStore } from "../../stores/market";
import { useWorldStore } from "../../stores/world";
import Modal from "../Modal.vue";
import FishSellConfirm from "./FishSellConfirm.vue";
import FishReleaseConfirm from "./FishReleaseConfirm.vue";
const worldStore = useWorldStore();
const caughtStore = useCaughtStore();
const marketStore = useMarketStore();
const fishToRelease = ref<any | null>(null);
const searchQuery = ref("");
const selectedRarity = ref("ALL");
const currentPage = ref(1);
const pageSize = 12;
const pageCount = computed(() => Math.max(1, Math.ceil(filteredCaughtFishes.value.length / pageSize)));
const paginatedCaughtFishes = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredCaughtFishes.value.slice(start, start + pageSize);
});
const isReleasing = ref(false);
const fishToSell = ref<any | null>(null);
const isSelling = ref(false);
const sellError = ref("");
const sellSuccess = ref(false);
const soldFishName = ref("");
let sellSuccessTimer: ReturnType<typeof setTimeout> | null = null;
const authStore = useAuthStore();

const filteredCaughtFishes = computed(() => {
  return caughtStore.caughtFishes.filter((item) => {
    const nameMatch =
      !searchQuery.value || item.species?.name?.toLowerCase().includes(searchQuery.value.toLowerCase().trim());
    const rarityMatch = selectedRarity.value === "ALL" || item.species?.rarity === selectedRarity.value;
    return nameMatch && rarityMatch;
  });
});

watch([searchQuery, selectedRarity], () => {
  currentPage.value = 1;
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

function submitSell(price: number) {
  void handleSell(price);
}

async function handleSell(priceNum: number) {
  if (!fishToSell.value) return;

  const userId = authStore.userId;
  if (!userId) {
    sellError.value = "Bạn chưa đăng nhập";
    return;
  }

  isSelling.value = true;
  sellError.value = "";

  try {
    const fishName = fishToSell.value.species?.name || "cá";
    await supabaseFishRepository.listFishOnMarket(fishToSell.value.id, priceNum);
    caughtStore.caughtFishes = caughtStore.caughtFishes.filter((f) => f.id !== fishToSell.value.id);
    await marketStore.loadMarketListings();
    cancelSell();
    showSellSuccess(fishName);
  } catch (err: any) {
    console.error("Lỗi khi đăng bán cá:", err);
    sellError.value = err.message || "Đăng bán không thành công. Vui lòng thử lại.";
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

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  } catch (err) {
    console.error("Lỗi khi thả cá:", err);
  } finally {
    isReleasing.value = false;
  }
}

function showSellSuccess(fishName: string) {
  soldFishName.value = fishName;
  sellSuccess.value = true;
  if (sellSuccessTimer) clearTimeout(sellSuccessTimer);
  sellSuccessTimer = setTimeout(() => {
    sellSuccess.value = false;
  }, 2500);
}

function closeSellSuccess() {
  sellSuccess.value = false;
  if (sellSuccessTimer) clearTimeout(sellSuccessTimer);
}
</script>
<template>
  <Modal
    class="caught-list-modal"
    title="Túi cá"
    sub-title="Những loài cá bạn sẵn được"
    :on-refresh="caughtStore.loadCaughtFishes"
  >
    <section class="h-full min-h-0 p-3 sm:p-5 text-[#263238] flex flex-col overflow-hidden">
      <!-- Header  -->
      <div class="flex items-center justify-between border-b border-gray-300 pb-3 mb-3">
        <div class="flex items-center gap-2">
          <h2 class="m-0 text-base font-bold text-[#263238]">Thành quả câu được</h2>
          <span class="px-2 py-0.5 rounded-full bg-[#153221] text-white text-[11px] font-extrabold shadow-xs">
            {{ caughtStore.caughtFishes.length }}
          </span>
        </div>
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
        class="h-0 grow overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start"
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
        <div
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
                <span class="shrink-0 ml-1">{{ formatDate(item.created_at) }}</span>
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
        v-if="filteredCaughtFishes.length > pageSize"
        class="flex items-center justify-between gap-3 border-t border-gray-200 pt-3 mt-3 text-xs"
      >
        <span class="text-gray-500"
          >Trang {{ currentPage }} / {{ pageCount }} ({{ filteredCaughtFishes.length }} cá)</span
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

  <!-- Dialog xác nhận thả cá -->
  <!-- Dialog Ä‘Äƒng bán cá -->
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
    @confirm="submitSell"
  />

  <!-- Popup thông báo bán thành công -->
  <Transition name="sell-success">
    <div
      v-if="sellSuccess"
      class="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-5 py-3 rounded-xl bg-emerald-600 text-white shadow-[0_8px_30px_rgba(21,50,33,0.35)] border border-emerald-500"
      @click="closeSellSuccess"
    >
      <span class="text-lg"></span>
      <span class="text-sm font-semibold"
        >Đã đăng bán <strong>{{ soldFishName }}</strong> thành công!</span
      >
    </div>
  </Transition>
</template>

<style scoped>
.sell-success-enter-active {
  animation: sell-success-in 0.4s ease-out;
}
.sell-success-leave-active {
  animation: sell-success-out 0.3s ease-in forwards;
}
@keyframes sell-success-in {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}
@keyframes sell-success-out {
  0% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.95);
  }
}
</style>
