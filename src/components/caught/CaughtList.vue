<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useCaughtStore } from '../../stores/caught';
import { useAuthStore } from '../../stores/auth';
import { supabaseFishRepository } from '../../data/supabaseFishRepository';
import { useMarketStore } from '../../stores/market';
const caughtStore = useCaughtStore()
const marketStore = useMarketStore()
const fishToRelease = ref<any | null>(null);
const searchQuery = ref("");
const selectedRarity = ref("ALL");
const isReleasing = ref(false);
const fishToSell = ref<any | null>(null);
const sellPrice = ref<number | "">("");
const isSelling = ref(false);
const sellError = ref("");
const authStore = useAuthStore();

const filteredCaughtFishes = computed(() => {
  return caughtStore.caughtFishes.filter((item) => {
    const nameMatch =
      !searchQuery.value || item.fish?.name?.toLowerCase().includes(searchQuery.value.toLowerCase().trim());
    const rarityMatch = selectedRarity.value === "ALL" || item.fish?.rarity === selectedRarity.value;
    return nameMatch && rarityMatch;
  });
});

const rarityOptions = computed(() => {
  const set = new Set<string>();
  caughtStore.caughtFishes.forEach((item) => {
    if (item.fish?.rarity) set.add(item.fish.rarity);
  });
  return Array.from(set);
});


function openSellConfirm(item: any) {
  fishToSell.value = item;
  sellPrice.value = "";
  sellError.value = "";
}

function cancelSell() {
  fishToSell.value = null;
  sellPrice.value = "";
  sellError.value = "";
}

async function handleSell() {
  if (!fishToSell.value) return;

  const priceNum = Number(sellPrice.value);
  if (!sellPrice.value || isNaN(priceNum) || priceNum <= 0) {
    sellError.value = "Vui lòng nhập giá bán hợp lệ (lớn hơn 0)";
    return;
  }

  const userId = authStore.user?.id;
  if (!userId) {
    sellError.value = "Bạn chưa đăng nhập";
    return;
  }

  isSelling.value = true;
  sellError.value = "";

  try {
    await supabaseFishRepository.listFishOnMarket(fishToSell.value.id, userId, priceNum);
    caughtStore.caughtFishes = caughtStore.caughtFishes.filter((f) => f.id !== fishToSell.value.id);
    await marketStore.loadMarketListings();
    cancelSell();
  } catch (err: any) {
    console.error("Lỗi khi đăng bán cá:", err);
    sellError.value = err.message || "Không thể đăng bán cá. Vui lòng thử lại.";
  } finally {
    isSelling.value = false;
  }
}


function getRarityBadgeClass(rarity: string) {
  switch (rarity?.toUpperCase()) {
    case "HUYỀN THOẠI":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "SỬ THI":
      return "bg-purple-100 text-purple-800 border-purple-300";
    case "HIẾM":
      return "bg-blue-100 text-blue-800 border-blue-300";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

function formatDate(dateStr: string) {
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

</script>
<template>
<aside
      class="caught-sidebar w-84 flex-none h-full p-4 border-[1px] border-gray-300 rounded-xl bg-white text-[#263238] flex flex-col overflow-hidden">
      <!-- Header tiêu đề -->
      <div class="flex items-center justify-between border-b border-gray-300 pb-3 mb-3">
        <div class="flex items-center gap-2">
          <h2 class="m-0 text-base font-bold text-[#263238]">Thành quả câu được</h2>
          <span class="px-2 py-0.5 rounded-full bg-[#153221] text-white text-[11px] font-extrabold shadow-xs">
            {{ caughtStore.caughtFishes.length }}
          </span>
        </div>
        <button type="button" title="Làm mới danh sách"
          class="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
          @click="caughtStore.loadCaughtFishes">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <!-- Công cụ tìm kiếm & bộ lọc -->
      <div class="flex flex-col gap-2 mb-3">
        <div class="relative">
          <input v-model="searchQuery" type="text" placeholder="Tìm theo tên cá..."
            class="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-gray-50/80" />
          <svg class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div v-if="rarityOptions.length"
          class="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] [scrollbar-width:none]">
          <button type="button"
            class="px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer whitespace-nowrap"
            :class="selectedRarity === 'ALL' ? 'bg-[#153221] text-white border-gray-300 font-bold' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'"
            @click="selectedRarity = 'ALL'">
            Tất cả
          </button>
          <button v-for="rarity in rarityOptions" :key="rarity" type="button"
            class="px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer whitespace-nowrap"
            :class="selectedRarity === rarity ? 'bg-[#153221] text-white border-gray-300 font-bold' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'"
            @click="selectedRarity = rarity">
            {{ rarity }}
          </button>
        </div>
      </div>

      <!-- Danh sách thẻ cá -->
      <div class="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
        <div v-if="caughtStore.isLoadingCaught" class="text-center text-xs text-gray-500">
          Đang tải danh sách cá...
        </div>
        <div v-else-if="!filteredCaughtFishes.length" class="py-12 text-center text-xs text-gray-400">
          {{ searchQuery || selectedRarity !== 'ALL' ? 'Không tìm thấy cá phù hợp' : 'Chưa có con cá nào trong bộ sưu tập' }}
        </div>
        <div v-for="item in filteredCaughtFishes" :key="item.id"
          class="p-2.5 border border-gray-200 hover:border-gray-300/40 rounded-xl bg-gray-50/70 hover:bg-emerald-50/30 transition-all flex gap-2.5 items-center shadow-2xs">
          <img :src="item.fish?.image || '/fish/VN/fish.jpg'" :alt="item.fish?.name"
            class="w-14 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-200 bg-gray-200" />
          <div class="flex-1 min-w-0 flex flex-col gap-0.5">
            <div class="flex items-center justify-between gap-1">
              <span class="font-bold text-xs truncate text-[#263238]">{{ item.fish?.name }}</span>
              <span class="px-1.5 py-0.2 text-[9px] font-extrabold rounded border flex-shrink-0 uppercase"
                :class="getRarityBadgeClass(item.fish?.rarity)">
                {{ item.fish?.rarity }}
              </span>
            </div>
            <div class="flex items-center gap-2 text-[11px] text-gray-600">
              <span>{{ typeof item.fish?.weight === 'number' ? item.fish.weight + ' kg' : item.fish?.weight }}</span>
              <span>•</span>
              <span>{{ item.fish?.length }}</span>
            </div>
            <div class="flex items-center justify-between text-[10px] text-gray-400">
              <span class="truncate text-emerald-800 font-medium">📍 {{ item.areaName }}</span>
              <span class="flex-shrink-0 ml-1">{{ formatDate(item.created_at) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0 self-center">
            <button type="button"
              class="px-2 py-1.5 border border-emerald-200 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors cursor-pointer"
              title="Đăng bán cá lên thị trường" @click="openSellConfirm(item)">
              Bán
            </button>
            <button type="button"
              class="px-2 py-1.5 border border-red-200 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition-colors cursor-pointer"
              title="Thả cá về lại tự nhiên" @click="openReleaseConfirm(item)">
              Thả
            </button>
          </div>
        </div>
      </div>
    </aside>
    
    <!-- Dialog xác nhận thả cá -->
    <div v-if="fishToRelease"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      @click.self="cancelRelease">
      <div
        class="w-full max-w-sm bg-white border-[1px] border-gray-300 rounded-xl p-5 shadow-[0_12px_32px_rgba(38,50,56,0.3)] text-center relative">
        <h3 class="m-0 text-base font-bold text-[#263238]">Xác nhận thả cá</h3>
        <p class="my-4 text-xs text-gray-600 leading-relaxed">
          Bạn có chắc chắn muốn thả con <strong class="text-[#153221]">{{ fishToRelease.fish?.name }}</strong> ({{
            typeof fishToRelease.fish?.weight === 'number'
              ? fishToRelease.fish.weight + ' kg'
              : fishToRelease.fish?.weight
          }}) câu tại <strong>{{ fishToRelease.areaName }}</strong> về lại tự nhiên không?
        </p>
        <div class="flex justify-center gap-3 mt-5">
          <button type="button"
            class="py-1.5 px-4 rounded-lg border border-gray-300 bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1]"
            @click="cancelRelease">
            Hủy
          </button>
          <button type="button"
            class="py-1.5 px-4 rounded-lg border border-red-600 bg-red-600 text-white text-xs font-bold cursor-pointer hover:bg-red-700 shadow-sm disabled:opacity-50"
            :disabled="isReleasing" @click="handleRelease">
            {{ isReleasing ? 'Đang thả...' : 'Xác nhận thả' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Dialog đăng bán cá -->
    <div v-if="fishToSell" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      @click.self="cancelSell">
      <div
        class="w-full max-w-sm bg-white border-[1px] border-gray-300 rounded-xl p-5 shadow-[0_12px_32px_rgba(38,50,56,0.3)] text-center relative">
        <h3 class="m-0 text-base font-bold text-[#263238]">Đăng bán cá</h3>
        <p class="my-3 text-xs text-gray-600 leading-relaxed">
          Đăng bán con <strong class="text-[#153221]">{{ fishToSell.fish?.name }}</strong> ({{
            typeof fishToSell.fish?.weight === 'number'
              ? fishToSell.fish.weight + ' kg'
              : fishToSell.fish?.weight
          }}) lên thị trường.
        </p>

        <div class="my-4 text-left">
          <label class="block text-xs font-bold text-gray-700 mb-1">Giá bán (đ)</label>
          <input v-model.number="sellPrice" type="number" min="1" placeholder="Nhập giá bán..."
            class="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300"
            @keyup.enter="handleSell" />
          <p v-if="sellError" class="mt-1 text-[11px] text-red-500 font-medium">{{ sellError }}</p>
        </div>

        <div class="flex justify-center gap-3 mt-5">
          <button type="button"
            class="py-1.5 px-4 rounded-lg border border-gray-300 bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1]"
            @click="cancelSell">
            Hủy
          </button>
          <button type="button"
            class="py-1.5 px-4 rounded-lg border border-gray-300 bg-[#153221] text-white text-xs font-bold cursor-pointer hover:bg-[#1a3e29] shadow-sm disabled:opacity-50"
            :disabled="isSelling" @click="handleSell">
            {{ isSelling ? 'Đang bán...' : 'Xác nhận bán' }}
          </button>
        </div>
      </div>
    </div>
</template>