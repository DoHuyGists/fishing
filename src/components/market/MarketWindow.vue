<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useCurrencyStore } from '../../stores/currency';
import { supabaseMarketRepository, type MarketListing } from '../../data/supabaseMarketRepository';
import { useAuthStore } from '../../stores/auth';
import { useMarketStore } from '../../stores/market';
import { useCaughtStore } from '../../stores/caught';
const authStore = useAuthStore();
const currencyStore = useCurrencyStore();
const activeMarketTab = ref<"all" | "my">("all");
const marketSearch = ref("");
const marketRarity = ref("ALL");
const marketSort = ref<"newest" | "price-asc" | "price-desc">("newest");
const itemToBuy = ref<MarketListing | null>(null);
const isBuying = ref(false);
const buyError = ref("");
const isCancellingListing = ref(false);
const marketStore = useMarketStore()
const caughtStore = useCaughtStore()

const filteredMarketListings = computed(() => {
  let result = marketStore.marketListings.filter((item) => {
    const fish = item.caught?.fish;
    const nameMatch = !marketSearch.value || fish?.name?.toLowerCase().includes(marketSearch.value.toLowerCase().trim());
    const rarityMatch = marketRarity.value === "ALL" || fish?.rarity === marketRarity.value;
    return nameMatch && rarityMatch;
  });

  if (marketSort.value === "price-asc") {
    result.sort((a, b) => a.price - b.price);
  } else if (marketSort.value === "price-desc") {
    result.sort((a, b) => b.price - a.price);
  } else {
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return result;
});

const myMarketListings = computed(() => {
  const currentUserId = authStore.user?.id;
  if (!currentUserId) return [];
  return marketStore.marketListings.filter((item) => item.user_id === currentUserId);
});

function confirmBuy(item: MarketListing) {
  itemToBuy.value = item;
  buyError.value = "";
}

function cancelBuy() {
  itemToBuy.value = null;
  buyError.value = "";
}

async function handleBuyFish() {
  if (!itemToBuy.value) return;
  const buyerId = authStore.user?.id;
  if (!buyerId) {
    buyError.value = "Bạn chưa đăng nhập";
    return;
  }

  isBuying.value = true;
  buyError.value = "";

  try {
    await supabaseMarketRepository.buyFish(buyerId, itemToBuy.value);
    await currencyStore.fetchCurrency(buyerId);
    await marketStore.loadMarketListings();
    await caughtStore.loadCaughtFishes();
    cancelBuy();
  } catch (err: any) {
    console.error("Lỗi khi mua cá:", err);
    buyError.value = err.message || "Không thể mua cá. Vui lòng thử lại.";
  } finally {
    isBuying.value = false;
  }
}

async function handleCancelListing(item: MarketListing) {
  if (!item.caught?.id) return;
  isCancellingListing.value = true;
  try {
    await supabaseMarketRepository.cancelListing(item.id, item.caught.id);
    await marketStore.loadMarketListings();
    await caughtStore.loadCaughtFishes();
  } catch (err) {
    console.error("Lỗi khi gỡ cá:", err);
  } finally {
    isCancellingListing.value = false;
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
</script>

<template>
     <div 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        class="w-full max-w-4xl max-h-[85vh] bg-white border-[1px] border-gray-300 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden relative">

        <!-- Header -->
        <div
          class="px-6 py-4 bg-[#153221] text-white flex items-center justify-between border-b border-emerald-800 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-emerald-700/60 border border-emerald-500/40 grid place-items-center text-xl shadow-inner">
              🏪
            </div>
            <div>
              <h2 class="m-0 text-lg font-extrabold tracking-wide">Chợ Cá - Sàn Giao Dịch</h2>
              <p class="m-0 text-xs text-emerald-200">Mua bán, giao dịch cá quý hiếm giữa các cần thủ</p>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <!-- Số tiền người dùng -->
            <div
              class="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-amber-300 font-bold text-sm">
              <span>💰</span>
              <span>{{ currencyStore.formattedCash }} đ</span>
            </div>

            <slot></slot>
          </div>
        </div>

        <!-- Navigation Tabs & Utility Toolbar -->
        <div
          class="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <!-- Tabs -->
          <div class="flex items-center bg-gray-200/80 p-1 rounded-xl gap-1 text-xs font-bold">
            <button type="button" class="px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              :class="activeMarketTab === 'all' ? 'bg-white text-[#153221] shadow-xs font-extrabold' : 'text-gray-600 hover:text-gray-900'"
              @click="activeMarketTab = 'all'">
              <span>🛒 Sàn giao dịch</span>
              <span class="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                {{ marketStore.marketListings.length }}
              </span>
            </button>
            <button type="button" class="px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              :class="activeMarketTab === 'my' ? 'bg-white text-[#153221] shadow-xs font-extrabold' : 'text-gray-600 hover:text-gray-900'"
              @click="activeMarketTab = 'my'">
              <span>📦 Cá của tôi đang bán</span>
              <span class="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                {{ myMarketListings.length }}
              </span>
            </button>
          </div>

          <!-- Quick Refresh Button -->
          <button type="button" @click="marketStore.loadMarketListings" title="Làm mới danh sách"
            class="px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors">
            <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': marketStore.isLoadingMarket }" fill="none" stroke="currentColor"
              viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Làm mới</span>
          </button>
        </div>

        <!-- Filter & Search Toolbar (shown for 'all' tab) -->
        <div v-if="activeMarketTab === 'all'"
          class="px-6 py-2.5 bg-white border-b border-gray-100 flex flex-wrap items-center gap-3 flex-shrink-0">
          <!-- Search input -->
          <div class="relative flex-1 min-w-[200px]">
            <input v-model="marketSearch" type="text" placeholder="Tìm kiếm cá rao bán..."
              class="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-gray-50/70" />
            <svg class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" fill="none" stroke="currentColor"
              viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <!-- Rarity filter -->
          <div class="flex items-center gap-1 text-xs">
            <span class="text-gray-500 font-medium text-[11px]">Độ hiếm:</span>
            <select v-model="marketRarity"
              class="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:outline-none">
              <option value="ALL">Tất cả</option>
              <option value="HUYỀN THOẠI">Huyền thoại</option>
              <option value="SỬ THI">Sử thi</option>
              <option value="HIẾM">Hiếm</option>
              <option value="THƯỜNG">Thường</option>
            </select>
          </div>

          <!-- Sort dropdown -->
          <div class="flex items-center gap-1 text-xs">
            <span class="text-gray-500 font-medium text-[11px]">Sắp xếp:</span>
            <select v-model="marketSort"
              class="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:outline-none">
              <option value="newest">Mới nhất</option>
              <option value="price-asc">Giá thấp ➔ cao</option>
              <option value="price-desc">Giá cao ➔ thấp</option>
            </select>
          </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-6 bg-gray-50/50">

          <!-- Tab 1: Sàn Giao Dịch -->
          <div v-if="activeMarketTab === 'all'">
            <div v-if="marketStore.isLoadingMarket"
              class="py-16 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
              <div class="w-8 h-8 border-[1px] border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Đang tải các cá đang giao dịch...</span>
            </div>

            <div v-else-if="!filteredMarketListings.length" class="py-16 text-center text-gray-400 text-xs">
              <span class="text-3xl block mb-2">🎣</span>
              <p class="m-0 font-medium">{{ marketSearch || marketRarity !== 'ALL' ? 'Không tìm thấy con cá nào phù hợp với bộ lọc' : 'Hiện chưa có cá nào được đăng bán trên thị trường.' }}</p>
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div v-for="item in filteredMarketListings" :key="item.id"
                class="bg-white border border-gray-200 hover:border-emerald-500/50 rounded-xl p-3 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between relative group">

                <div>
                  <!-- Header hình cá -->
                  <div class="relative w-full h-32 rounded-lg overflow-hidden bg-gray-100 mb-2 border border-gray-100">
                    <img :src="item.caught?.fish?.image || '/fish/VN/fish.jpg'" :alt="item.caught?.fish?.name"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />

                    <span
                      class="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-extrabold rounded border uppercase shadow-xs backdrop-blur-xs"
                      :class="getRarityBadgeClass(item.caught?.fish?.rarity)">
                      {{ item.caught?.fish?.rarity }}
                    </span>

                    <!-- Badge nếu là cá của bản thân -->
                    <span v-if="item.user_id === authStore.user?.id"
                      class="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-white font-extrabold text-[9px] rounded shadow-xs">
                      Cá của bạn
                    </span>
                  </div>

                  <!-- Thông tin chi tiết -->
                  <div class="flex flex-col gap-1 mb-3">
                    <h4 class="m-0 font-bold text-sm text-[#263238] truncate">{{ item.caught?.fish?.name }}</h4>
                    <div class="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                      <span>⚖️ {{ typeof item.caught?.fish?.weight === 'number' ? item.caught.fish.weight + ' kg' :
                        item.caught?.fish?.weight }}</span>
                      <span>•</span>
                      <span>📏 {{ item.caught?.fish?.length }}</span>
                    </div>
                    <div class="text-[10px] text-gray-400 mt-0.5">
                      📅 Đăng bán: {{ formatDate(item.created_at) }}
                    </div>
                  </div>
                </div>

                <!-- Footer Giá & Nút Mua -->
                <div class="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 mt-auto">
                  <div class="flex flex-col">
                    <span class="text-[10px] text-gray-400 uppercase font-bold">Giá bán</span>
                    <span class="text-sm font-extrabold text-amber-600">{{ item.price.toLocaleString('vi-VN') }}
                      đ</span>
                  </div>

                  <button v-if="item.user_id === authStore.user?.id" type="button" disabled
                    class="px-3 py-1.5 bg-gray-100 text-gray-400 font-bold text-xs rounded-lg cursor-not-allowed">
                    Đã đăng
                  </button>

                  <button v-else type="button" @click="confirmBuy(item)"
                    class="px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1">
                    <span>Mua cá</span>
                  </button>
                </div>

              </div>
            </div>
          </div>

          <!-- Tab 2: Cá Của Tôi Đang Bán -->
          <div v-else-if="activeMarketTab === 'my'">
            <div v-if="!myMarketListings.length" class="py-16 text-center text-gray-400 text-xs">
              <span class="text-3xl block mb-2">📦</span>
              <p class="m-0 font-medium">Bạn chưa đăng bán con cá nào trên chợ.</p>
              <p class="mt-1 text-gray-400">Chọn cá trong danh sách túi đồ bên phải và nhấn nút <strong>"Bán"</strong>
                để rao bán cá.</p>
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div v-for="item in myMarketListings" :key="item.id"
                class="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs flex flex-col justify-between">

                <div>
                  <div class="relative w-full h-32 rounded-lg overflow-hidden bg-gray-100 mb-2 border border-gray-100">
                    <img :src="item.caught?.fish?.image || '/fish/VN/fish.jpg'" :alt="item.caught?.fish?.name"
                      class="w-full h-full object-cover" />

                    <span
                      class="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-extrabold rounded border uppercase shadow-xs"
                      :class="getRarityBadgeClass(item.caught?.fish?.rarity)">
                      {{ item.caught?.fish?.rarity }}
                    </span>
                  </div>

                  <div class="flex flex-col gap-1 mb-3">
                    <h4 class="m-0 font-bold text-sm text-[#263238] truncate">{{ item.caught?.fish?.name }}</h4>
                    <div class="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                      <span>⚖️ {{ typeof item.caught?.fish?.weight === 'number' ? item.caught.fish.weight + ' kg' :
                        item.caught?.fish?.weight }}</span>
                      <span>•</span>
                      <span>📏 {{ item.caught?.fish?.length }}</span>
                    </div>
                    <div class="text-[10px] text-gray-400">
                      📅 Ngày đăng: {{ formatDate(item.created_at) }}
                    </div>
                  </div>
                </div>

                <div class="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div>
                    <span class="text-[10px] text-gray-400 uppercase font-bold block">Giá niêm yết</span>
                    <span class="text-sm font-extrabold text-amber-600">{{ item.price.toLocaleString('vi-VN') }}
                      đ</span>
                  </div>

                  <button type="button" @click="handleCancelListing(item)" :disabled="isCancellingListing"
                    class="px-3 py-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg transition-colors cursor-pointer">
                    {{ isCancellingListing ? 'Đang gỡ...' : 'Gỡ bán' }}
                  </button>
                </div>

              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
    <!-- Confirm Buy Dialog -->
    <div v-if="itemToBuy" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      @click.self="cancelBuy">
      <div
        class="w-full max-w-sm bg-white border-[1px] border-gray-300 rounded-xl p-5 shadow-[0_12px_32px_rgba(38,50,56,0.3)] text-center relative">
        <h3 class="m-0 text-base font-bold text-[#263238]">Xác nhận mua cá</h3>

        <div class="my-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-left">
          <img :src="itemToBuy.caught?.fish?.image || '/fish/VN/fish.jpg'"
            class="w-12 h-12 rounded-lg object-cover border border-emerald-300" />
          <div class="flex-1 min-w-0">
            <h4 class="m-0 text-xs font-bold text-[#263238] truncate">{{ itemToBuy.caught?.fish?.name }}</h4>
            <div class="text-[11px] text-amber-700 font-extrabold mt-0.5">{{ itemToBuy.price.toLocaleString('vi-VN') }}
              đ</div>
          </div>
        </div>

        <p class="text-xs text-gray-600 leading-relaxed mb-4">
          Số tiền hiện có của bạn: <strong class="text-amber-600">{{ currencyStore.formattedCash }} đ</strong>
        </p>

        <p v-if="buyError"
          class="mb-3 text-[11px] text-red-500 font-medium bg-red-50 p-2 rounded border border-red-200">{{ buyError }}
        </p>

        <div class="flex justify-center gap-3">
          <button type="button"
            class="py-1.5 px-4 rounded-lg border border-gray-300 bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1]"
            @click="cancelBuy">
            Hủy
          </button>
          <button type="button"
            class="py-1.5 px-4 rounded-lg border border-gray-300 bg-[#153221] text-white text-xs font-bold cursor-pointer hover:bg-[#1a3e29] shadow-sm disabled:opacity-50"
            :disabled="isBuying" @click="handleBuyFish">
            {{ isBuying ? 'Đang giao dịch...' : 'Xác nhận mua' }}
          </button>
        </div>
      </div>
    </div>
</template>