<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useCurrencyStore } from "../../../stores/currency.ts";
import { supabaseMarketRepository, type MarketListing } from "../../../data/supabaseMarketRepository.ts";
import { useAuthStore } from "../../../stores/auth.ts";
import { useMarketStore } from "../../../stores/market.ts";
import { useCaughtStore } from "../../../stores/caught.ts";
import Cash from "../currency/Cash.vue";
import Modal from "../../shared/Modal.vue";
import { useToast } from "../../../composables/useToast.ts";

const authStore = useAuthStore();
const currencyStore = useCurrencyStore();
const activeMarketTab = ref<"all" | "my">("all");
const viewMode = ref<"list" | "grid" | "species">("grid");
const toast = useToast();
const marketSearch = ref("");
const marketRarity = ref("ALL");
const marketSort = ref<"newest" | "price-asc" | "price-desc">("newest");
const itemToBuy = ref<MarketListing | null>(null);
const isBuying = ref(false);
const isCancellingListing = ref(false);
const marketStore = useMarketStore();
const caughtStore = useCaughtStore();
const LISTED_PRICE = 500;
const emit = defineEmits(["close"]);
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
const filteredMarketListings = computed(() => {
  let result = marketStore.marketListings.filter((item) => {
    const fish = item.caught?.fish;
    const nameMatch =
      !marketSearch.value || fish?.name?.toLowerCase().includes(marketSearch.value.toLowerCase().trim());
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
  const currentUserId = authStore.userId;
  if (!currentUserId) return [];
  return marketStore.marketListings.filter((item) => item.user_id === currentUserId);
});

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
  itemToBuy.value = item;
}

function cancelBuy() {
  itemToBuy.value = null;
}

async function handleBuyFish() {
  if (!itemToBuy.value) return;
  if (!authStore.userId) {
    toast.error("Bạn chưa đăng nhập", { title: "Không thể mua cá", position: "bottom" });
    return;
  }

  isBuying.value = true;
  try {
    const fishName = itemToBuy.value.caught?.fish?.name || "cá";
    await supabaseMarketRepository.buyFish(itemToBuy.value.id);
    await marketStore.loadMarketListings();
    await caughtStore.loadCaughtFishes();
    cancelBuy();
    toast.success(`Mua ${fishName} thành công!`, { title: "Giao dịch thành công", position: "bottom" });
  } catch (err: any) {
    console.error("Lỗi khi mua cá:", err);
    toast.error(err?.message || "Không thể mua cá. Vui lòng thử lại.", {
      title: "Mua cá thất bại",
      position: "bottom",
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
    toast.success("Đã gỡ tin bán cá", { title: "Thành công", position: "bottom" });
  } catch (err) {
    console.error("Lỗi khi gỡ cá:", err);
    toast.error("Bạn chưa đăng nhập", { title: "Không thể mua cá", position: "bottom" });
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
function getRarityBadgeClass(rarity: string | null | undefined) {
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

onMounted(() => {
  marketStore.loadMarketListings();
});
</script>

<template>
  <Modal title="Chợ cá" :on-refresh="marketStore.loadMarketListings">
    <div class="w-full h-full bg-white flex flex-col overflow-hidden relative">
      <!-- Navigation Tabs & Utility Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <!-- Tabs -->
        <div class="flex items-center bg-gray-200/80 p-1 rounded-xl gap-1 text-xs font-bold">
          <button
            type="button"
            class="px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
            :class="
              activeMarketTab === 'all'
                ? 'bg-white text-[#153221] shadow-xs font-extrabold'
                : 'text-gray-600 hover:text-gray-900'
            "
            @click="activeMarketTab = 'all'"
          >
            <span>🛒 Sàn giao dịch</span>
            <span class="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
              {{ marketStore.marketListings.length }}
            </span>
          </button>
          <button
            type="button"
            class="px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
            :class="
              activeMarketTab === 'my'
                ? 'bg-white text-[#153221] shadow-xs font-extrabold'
                : 'text-gray-600 hover:text-gray-900'
            "
            @click="activeMarketTab = 'my'"
          >
            <span>📦 Cá của tôi đang bán</span>
            <span class="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
              {{ myMarketListings.length }}
            </span>
          </button>
        </div>
      </div>

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
            placeholder="Tìm kiếm cá rao bán..."
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
          <span class="text-gray-500 font-medium text-[11px]">Độ hiếm:</span>
          <select
            v-model="marketRarity"
            class="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:outline-none"
          >
            <option value="ALL">Tất cả</option>
            <option value="HUYỀN THOẠI">Huyền thoại</option>
            <option value="SỬ THI">Sử thi</option>
            <option value="HIẾM">Hiếm</option>
            <option value="THƯỜNG">Thường</option>
          </select>
        </div>

        <div
          class="ml-auto flex rounded-lg border border-gray-200 bg-white p-0.5"
          role="group"
          aria-label="Chế độ hiển thị"
        >
          <button
            type="button"
            class="rounded-md px-2 py-1 text-[11px] font-bold"
            :class="viewMode === 'list' ? 'bg-[#153221] text-white' : 'text-gray-600 hover:bg-gray-100'"
            :aria-pressed="viewMode === 'list'"
            @click="viewMode = 'list'"
          >
            Danh sách
          </button>
          <button
            type="button"
            class="rounded-md px-2 py-1 text-[11px] font-bold"
            :class="viewMode === 'grid' ? 'bg-[#153221] text-white' : 'text-gray-600 hover:bg-gray-100'"
            :aria-pressed="viewMode === 'grid'"
            @click="viewMode = 'grid'"
          >
            Lưới
          </button>
          <button
            type="button"
            class="rounded-md px-2 py-1 text-[11px] font-bold"
            :class="viewMode === 'species' ? 'bg-[#153221] text-white' : 'text-gray-600 hover:bg-gray-100'"
            :aria-pressed="viewMode === 'species'"
            @click="viewMode = 'species'"
          >
            Theo loài
          </button>
        </div>
        <!-- Sort dropdown -->
        <div class="flex items-center gap-1 text-xs">
          <span class="text-gray-500 font-medium text-[11px]">Sắp xếp:</span>
          <select
            v-model="marketSort"
            class="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:outline-none"
          >
            <option value="newest">Mới nhất</option>
            <option value="price-asc">Giá thấp ➔ cao</option>
            <option value="price-desc">Giá cao ➔ thấp</option>
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
            <span>Đang tải các cá đang giao dịch...</span>
          </div>

          <div v-else-if="!filteredMarketListings.length" class="py-16 text-center text-gray-400 text-xs">
            <span class="text-3xl block mb-2">🎣</span>
            <p class="m-0 font-medium">
              {{
                marketSearch || marketRarity !== "ALL"
                  ? "Không tìm thấy con cá nào phù hợp với bộ lọc"
                  : "Hiện chưa có cá nào được đăng bán trên thị trường."
              }}
            </p>
          </div>

          <div
            v-else-if="viewMode === 'species'"
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
          >
            <section
              v-for="group in groupedListings"
              :key="group.id"
              class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div class="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
                <span class="truncate text-xs font-bold">{{
                  group.listings[0]?.caught?.fish?.name || "Cá chưa rõ tên"
                }}</span>
                <span class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
                  >{{ group.listings.length }} tin</span
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
                    <div class="text-xs font-bold text-amber-700">{{ item.price.toLocaleString("vi-VN") }} đ</div>
                  </div>
                  <button
                    v-if="item.user_id === authStore.userId"
                    type="button"
                    disabled
                    class="rounded bg-gray-100 px-2 py-1 text-[10px] text-gray-400"
                  >
                    Đã đăng
                  </button>
                  <button
                    v-else
                    type="button"
                    class="rounded bg-[#153221] px-2 py-1 text-[10px] font-bold text-white"
                    @click="confirmBuy(item)"
                  >
                    Mua
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
              class="bg-white border border-gray-200 hover:border-emerald-500/50 rounded-xl p-3 shadow-2xs hover:shadow-md transition-all relative group"
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
                    Cá của bạn
                  </span>
                </div>

                <!-- Thông tin chi tiết -->
                <div class="flex flex-col gap-1 mb-3" :class="viewMode === 'list' ? 'min-w-0 flex-1' : ''">
                  <h4 class="m-0 font-bold text-sm text-[#263238] truncate">{{ item.caught?.fish?.name }}</h4>
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
                  <div class="text-[10px] text-gray-400 mt-0.5">📅 Đăng bán: {{ formatDate(item.created_at) }}</div>
                </div>
              </div>

              <!-- Footer Giá & Nút Mua -->
              <div
                class="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 mt-auto"
                :class="viewMode === 'list' ? 'border-t-0 border-l pl-3' : ''"
              >
                <div class="flex flex-col">
                  <span class="text-[10px] text-gray-400 uppercase font-bold">Giá bán</span>
                  <span class="text-sm font-extrabold text-amber-600">{{ item.price.toLocaleString("vi-VN") }} đ</span>
                </div>

                <button
                  v-if="item.user_id === authStore.userId"
                  type="button"
                  disabled
                  class="px-3 py-1.5 bg-gray-100 text-gray-400 font-bold text-xs rounded-lg cursor-not-allowed"
                >
                  Đã đăng
                </button>

                <button
                  v-else
                  type="button"
                  @click="confirmBuy(item)"
                  class="px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                >
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
            <p class="mt-1 text-gray-400">
              Chọn cá trong danh sách túi đồ bên phải và nhấn nút <strong>"Bán"</strong> để rao bán cá.
            </p>
          </div>

          <div
            v-else
            :class="
              viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4' : 'flex flex-col gap-2'
            "
          >
            <div
              v-for="item in myMarketListings"
              :key="item.id"
              class="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs"
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
                  <h4 class="m-0 font-bold text-sm text-[#263238] truncate">{{ item.caught?.fish?.name }}</h4>
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
                  <div class="text-[10px] text-gray-400">📅 Ngày đăng: {{ formatDate(item.created_at) }}</div>
                </div>
              </div>

              <div class="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                <div>
                  <span class="text-[10px] text-gray-400 uppercase font-bold block">Giá niêm yết</span>
                  <span class="text-sm font-extrabold text-amber-600">{{ item.price.toLocaleString("vi-VN") }} đ</span>
                </div>

                <button
                  type="button"
                  @click="handleCancelListing(item)"
                  :disabled="isCancellingListing"
                  class="px-3 py-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  {{ isCancellingListing ? "Đang gỡ..." : "Gỡ bán" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
  <!-- Confirm Buy Dialog -->
  <div
    v-if="itemToBuy"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    @click.self="cancelBuy"
  >
    <div
      class="w-full max-w-sm bg-white border border-gray-300 rounded-xl p-5 shadow-[0_12px_32px_rgba(38,50,56,0.3)] text-center relative"
    >
      <h3 class="m-0 text-base font-bold text-[#263238]">Xác nhận mua cá</h3>

      <div class="my-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-left">
        <img :src="itemToBuy.caught?.fish?.image || '/fish/VN/fish.jpg'" class="h-12 rounded-lg object-cover" />
        <div class="flex-1 min-w-0">
          <div class="m-0 text-xs font-bold text-[#263238] truncate">{{ itemToBuy.caught?.fish?.name }}</div>
          <div class="m-0 text-xs font-bold text-[#263238] truncate">{{ itemToBuy.caught?.fish?.weight }} kg</div>
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs text-gray-600 leading-relaxed">
        <span>Số dư hiện có: </span>
        <Cash :amount="currencyStore.formattedCash" />
      </div>
      <hr class="my-2" />
      <div class="flex items-center gap-2 text-xs text-gray-600 leading-relaxed">
        <span>Giá:</span>
        <Cash :amount="itemToBuy.price" />
      </div>
      <div class="flex items-center gap-2 text-xs">
        <span>Phí niêm yết thị trường:</span>
        <Cash :amount="LISTED_PRICE" />
      </div>
      <div class="flex items-center gap-2 text-xs">
        <span>Phí cân bằng thị trường: </span>
        <Cash :amount="balanceFee" />
      </div>
      <hr class="my-2" />
      <div class="flex items-center gap-2 text-xs">
        <span>Tổng phí: </span>
        <Cash :amount="LISTED_PRICE + balanceFee + itemToBuy.price" />
      </div>

      <div class="flex justify-center gap-3 mt-4">
        <button
          type="button"
          class="py-1.5 px-4 rounded-lg border border-gray-300 bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1]"
          @click="cancelBuy"
        >
          Hủy
        </button>
        <button
          type="button"
          class="py-1.5 px-4 rounded-lg border border-gray-300 bg-[#153221] text-white text-xs font-bold cursor-pointer hover:bg-[#1a3e29] shadow-sm disabled:opacity-50"
          :disabled="isBuying"
          @click="handleBuyFish"
        >
          {{ isBuying ? "Đang xử lý..." : "Mua" }}
        </button>
      </div>
    </div>
  </div>
</template>
