<script setup lang="ts">
import { computed, onMounted, watch, ref } from "vue";
import { useFishingAreaStore } from "../stores/fishingArea";
import World from "./World.vue";
import { useWorldStore } from "../stores/world.ts";
import { useCurrencyStore } from "../stores/currency";
import { useAuthStore } from "../stores/auth";
import { supabaseFishRepository } from "../data/supabaseFishRepository";
import { supabaseMarketRepository, type MarketListing } from "../data/supabaseMarketRepository";

const MAP_VIEW_STORAGE_KEY = "worldMapView";

const hoveredTitle = ref("");
const tooltipPos = ref({ x: 0, y: 0 });
const zoom = ref(1);
const pan = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const didDrag = ref(false);
const isAnchorMode = ref(false);
const isProfileOpen = ref(false);
const mapFrame = ref<HTMLElement | null>(null);
const dragStart = ref({ x: 0, y: 0 });
const panStart = ref({ x: 0, y: 0 });
const fishingAreaStore = useFishingAreaStore();
const currencyStore = useCurrencyStore();
const authStore = useAuthStore();
const anchors = computed(() => fishingAreaStore.areas);
const worldStore = useWorldStore();

// Quản lý cá đã câu
const caughtFishes = ref<
  Array<{
    id: string;
    created_at: string;
    user_id: string;
    area_id: string;
    fish: any;
    areaName?: string;
  }>
>([]);
const isLoadingCaught = ref(false);
const searchQuery = ref("");
const selectedRarity = ref("ALL");
const fishToRelease = ref<any | null>(null);
const isReleasing = ref(false);
const fishToSell = ref<any | null>(null);
const sellPrice = ref<number | "">("");
const isSelling = ref(false);
const sellError = ref("");

// Quản lý Chợ Cá (Market)
const isMarketOpen = ref(false);
const activeMarketTab = ref<"all" | "my">("all");
const marketListings = ref<MarketListing[]>([]);
const isLoadingMarket = ref(false);
const marketSearch = ref("");
const marketRarity = ref("ALL");
const marketSort = ref<"newest" | "price-asc" | "price-desc">("newest");

const itemToBuy = ref<MarketListing | null>(null);
const isBuying = ref(false);
const buyError = ref("");
const isCancellingListing = ref(false);

async function loadMarketListings() {
  isLoadingMarket.value = true;
  try {
    const data = await supabaseMarketRepository.fetchActiveListings();
    marketListings.value = data;
  } catch (err) {
    console.error("Lỗi khi tải chợ cá:", err);
  } finally {
    isLoadingMarket.value = false;
  }
}

function openMarketModal() {
  isMarketOpen.value = true;
  loadMarketListings();
}

const filteredMarketListings = computed(() => {
  let result = marketListings.value.filter((item) => {
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
  return marketListings.value.filter((item) => item.user_id === currentUserId);
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
    await loadMarketListings();
    await loadCaughtFishes();
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
    await loadMarketListings();
    await loadCaughtFishes();
  } catch (err) {
    console.error("Lỗi khi gỡ cá:", err);
  } finally {
    isCancellingListing.value = false;
  }
}

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
    caughtFishes.value = caughtFishes.value.filter((f) => f.id !== fishToSell.value.id);
    loadMarketListings();
    cancelSell();
  } catch (err: any) {
    console.error("Lỗi khi đăng bán cá:", err);
    sellError.value = err.message || "Không thể đăng bán cá. Vui lòng thử lại.";
  } finally {
    isSelling.value = false;
  }
}

async function loadCaughtFishes() {
  const userId = authStore.user?.id;
  if (!userId) return;
  isLoadingCaught.value = true;
  try {
    const rows = await supabaseFishRepository.fetchAllCaughtFishes(userId);
    caughtFishes.value = rows.map((row) => {
      const area = fishingAreaStore.areas.find((a) => a.id === row.area_id);
      return {
        ...row,
        areaName: area?.title ?? "Bãi câu",
      };
    });
  } catch (err) {
    console.error("Lỗi khi tải danh sách cá:", err);
  } finally {
    isLoadingCaught.value = false;
  }
}

const filteredCaughtFishes = computed(() => {
  return caughtFishes.value.filter((item) => {
    const nameMatch =
      !searchQuery.value || item.fish?.name?.toLowerCase().includes(searchQuery.value.toLowerCase().trim());
    const rarityMatch = selectedRarity.value === "ALL" || item.fish?.rarity === selectedRarity.value;
    return nameMatch && rarityMatch;
  });
});

const rarityOptions = computed(() => {
  const set = new Set<string>();
  caughtFishes.value.forEach((item) => {
    if (item.fish?.rarity) set.add(item.fish.rarity);
  });
  return Array.from(set);
});

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
    caughtFishes.value = caughtFishes.value.filter((f) => f.id !== fishToRelease.value.id);
    fishToRelease.value = null;
  } catch (err) {
    console.error("Lỗi khi thả cá:", err);
  } finally {
    isReleasing.value = false;
  }
}

watch(
  () => authStore.user?.id,
  (userId) => {
    if (userId) {
      currencyStore.fetchCurrency(userId);
      loadCaughtFishes();
    }
  },
  { immediate: true }
);

watch(
  () => fishingAreaStore.areas,
  () => {
    if (caughtFishes.value.length && fishingAreaStore.areas.length) {
      caughtFishes.value = caughtFishes.value.map((row) => {
        const area = fishingAreaStore.areas.find((a) => a.id === row.area_id);
        return {
          ...row,
          areaName: area?.title ?? row.areaName ?? "Bãi câu",
        };
      });
    }
  }
);

function loadMapView() {
  try {
    const raw = localStorage.getItem(MAP_VIEW_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved?.zoom === "number") {
      zoom.value = saved.zoom;
    }
    if (saved?.pan && typeof saved.pan.x === "number" && typeof saved.pan.y === "number") {
      pan.value = { x: saved.pan.x, y: saved.pan.y };
    }
  } catch {
    // ignore corrupted storage
  }
}

function saveMapView() {
  localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify({ zoom: zoom.value, pan: pan.value }));
}

function zoomToArea(anchor: any) {
  localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(anchor.location));
}

function handleSelectArea(anchor: any) {
  zoomToArea(anchor);
  loadMapView();
  setTimeout(() => {
    worldStore.selectArea(anchor);
  }, 0);
}

function resetZoom() {
  zoom.value = MIN_ZOOM;
  pan.value = { x: 0, y: 0 };
  worldStore.selectArea({});
}

watch([zoom, pan], saveMapView, { deep: true });

onMounted(() => {
  fishingAreaStore.fetchArea();
  loadMapView();
  if (authStore.user?.id) {
    currencyStore.fetchCurrency(authStore.user.id);
    loadCaughtFishes();
  }
});

const MIN_ZOOM = 1;
const MAX_ZOOM = 40;
const ZOOM_STEP = 1;

function handleMouseMove(event: any) {
  const targetTitle = event.target.getAttribute("title");

  if (targetTitle) {
    hoveredTitle.value = targetTitle;
    tooltipPos.value = { x: event.clientX + 10, y: event.clientY + 10 };
  } else {
    hoveredTitle.value = "";
  }
}

function handleWheel(event: WheelEvent) {
  if (!event.ctrlKey) {
    return;
  }

  event.preventDefault();
  if (!mapFrame.value) {
    return;
  }

  const previousZoom = zoom.value;
  const direction = event.deltaY < 0 ? 1 : -1;
  const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((zoom.value + direction * ZOOM_STEP).toFixed(2))));
  const frameRect = mapFrame.value.getBoundingClientRect();
  const mouseOffset = {
    x: event.clientX - (frameRect.left + frameRect.width / 2),
    y: event.clientY - (frameRect.top + frameRect.height / 2),
  };

  pan.value = {
    x: mouseOffset.x - (nextZoom / previousZoom) * (mouseOffset.x - pan.value.x),
    y: mouseOffset.y - (nextZoom / previousZoom) * (mouseOffset.y - pan.value.y),
  };
  zoom.value = nextZoom;
  clampPan();
}

function clampPan() {
  if (!mapFrame.value) {
    return;
  }

  const { width, height } = mapFrame.value.getBoundingClientRect();
  const maxPanX = (width * (zoom.value - 1)) / 2;
  const maxPanY = (height * (zoom.value - 1)) / 2;

  pan.value = {
    x: Math.min(maxPanX, Math.max(-maxPanX, pan.value.x)),
    y: Math.min(maxPanY, Math.max(-maxPanY, pan.value.y)),
  };
}

function handlePointerDown(event: PointerEvent) {
  const target = event.target as Element | null;
  if (target?.closest(".anchors")) {
    return;
  }

  if (zoom.value === MIN_ZOOM || event.button !== 0 || !mapFrame.value) {
    return;
  }

  isDragging.value = true;
  dragStart.value = { x: event.clientX, y: event.clientY };
  panStart.value = { ...pan.value };
  mapFrame.value.setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent) {
  if (!isDragging.value) {
    return;
  }

  if (Math.hypot(event.clientX - dragStart.value.x, event.clientY - dragStart.value.y) > 3) {
    didDrag.value = true;
  }

  pan.value = {
    x: panStart.value.x + event.clientX - dragStart.value.x,
    y: panStart.value.y + event.clientY - dragStart.value.y,
  };
  clampPan();
}

function stopDragging(event: PointerEvent) {
  if (!isDragging.value) {
    return;
  }

  isDragging.value = false;
  mapFrame.value?.releasePointerCapture(event.pointerId);
}
</script>

<template>
  <div class="map-page h-screen p-3 relative flex gap-3 overflow-hidden">
    <!-- Sidebar trái: Danh sách bãi câu -->
    <aside
      class="map-sidebar w-60 flex-none h-full p-4 border-2 border-[#263238] rounded-xl bg-white text-[#263238] shadow-[0_8px_24px_rgba(38,50,56,0.12)] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between">
        <h2 class="m-0 text-lg font-bold">Bản đồ</h2>
      </div>

      <button type="button"
        class="mt-4 w-full py-2 px-3 rounded-lg border border-[#263238] bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1] transition-colors"
        @click="resetZoom">
        Reset zoom
      </button>

      <div class="mt-5 flex-1 overflow-y-auto">
        <div class="flex items-center justify-between text-[13px] font-bold">
          <span>Danh sách bãi câu</span>
        </div>
        <p v-if="!anchors.length" class="mt-[3px] mb-0 text-[#607176] text-xs">Chưa có điểm neo</p>
        <ul v-else class="grid gap-2 p-0 mt-3 mb-0 list-none">
          <li v-for="(anchor, index) in anchors" :key="anchor.id" class="flex items-center gap-2 min-w-0">
            <span
              class="grid place-items-center w-6 h-6 rounded-full bg-[#d84315] text-white text-xs font-bold flex-shrink-0">{{
                index + 1
              }}</span>
            <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs">
              <button @click="handleSelectArea(anchor)" type="button"
                class="cursor-pointer font-medium hover:underline text-left w-full truncate">{{ anchor.title }}</button>
            </span>
          </li>
        </ul>
      </div>
    </aside>

    <!-- Khung Bản đồ trung tâm -->
    <div class="space-y-4">
      <div ref="mapFrame"
        class="map-frame flex-1 min-w-0 h-full overflow-hidden border-2 border-[#263238] rounded-xl bg-[#eef3f1] shadow-[0_8px_24px_rgba(38,50,56,0.18)] touch-none relative"
        :class="isDragging ? 'cursor-grabbing' : isAnchorMode ? 'cursor-crosshair' : 'cursor-grab'"
        @wheel.stop="handleWheel" @pointerdown="handlePointerDown" @pointermove="handlePointerMove"
        @pointerup="stopDragging" @pointercancel="stopDragging">
        <div
          class="w-full h-full relative grid place-items-center origin-center transition-transform duration-[120ms] ease-out"
          :class="{ '!transition-none': isDragging }"
          :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }">
          <World class="w-full h-full" @mousemove="handleMouseMove" :anchors="anchors" :zoom="zoom" />
        </div>
      </div>

      <!-- Thanh thông tin góc trên bên trái của map -->
      <div class="flex items-center gap-2">
        <div
          class="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm border-2 border-[#263238] rounded-xl shadow-sm text-[#263238] font-bold text-2xl">
          <!-- <img src="/currency/cash.png" width="70" alt=""> -->
          <span>{{ currencyStore.formattedCash }}</span>
        </div>
      </div>
    </div>


    <!-- Sidebar phải: Danh sách cá đã câu được -->
    <aside
      class="caught-sidebar w-84 flex-none h-full p-4 border-2 border-[#263238] rounded-xl bg-white text-[#263238] shadow-[0_8px_24px_rgba(38,50,56,0.12)] flex flex-col overflow-hidden">
      <!-- Header tiêu đề -->
      <div class="flex items-center justify-between border-b border-[#e0e6e4] pb-3 mb-3">
        <div class="flex items-center gap-2">
          <h2 class="m-0 text-base font-bold text-[#263238]">Thành quả câu được</h2>
          <span class="px-2 py-0.5 rounded-full bg-[#153221] text-white text-[11px] font-extrabold shadow-xs">
            {{ caughtFishes.length }}
          </span>
        </div>
        <button type="button" title="Làm mới danh sách"
          class="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
          @click="loadCaughtFishes">
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
            class="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#153221] bg-gray-50/80" />
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
            :class="selectedRarity === 'ALL' ? 'bg-[#153221] text-white border-[#153221] font-bold' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'"
            @click="selectedRarity = 'ALL'">
            Tất cả
          </button>
          <button v-for="rarity in rarityOptions" :key="rarity" type="button"
            class="px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer whitespace-nowrap"
            :class="selectedRarity === rarity ? 'bg-[#153221] text-white border-[#153221] font-bold' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'"
            @click="selectedRarity = rarity">
            {{ rarity }}
          </button>
        </div>
      </div>

      <!-- Danh sách thẻ cá -->
      <div class="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
        <div v-if="isLoadingCaught" class="py-12 text-center text-xs text-gray-500">
          Đang tải danh sách cá...
        </div>
        <div v-else-if="!filteredCaughtFishes.length" class="py-12 text-center text-xs text-gray-400">
          {{ searchQuery || selectedRarity !== 'ALL' ? 'Không tìm thấy cá phù hợp' : 'Chưa có con cá nào trong bộ sưu tập' }}
        </div>
        <div v-for="item in filteredCaughtFishes" :key="item.id"
          class="p-2.5 border border-gray-200 hover:border-[#153221]/40 rounded-xl bg-gray-50/70 hover:bg-emerald-50/30 transition-all flex gap-2.5 items-center shadow-2xs">
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
    <div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm border-2 border-[#263238] hover:bg-white rounded-xl shadow-sm text-[#263238] font-bold text-xs cursor-pointer transition-colors"
          @click="isProfileOpen = true"
        >
          <span>Tài khoản</span>
        </button>
  
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#153221] hover:bg-[#1a3e29] border-2 border-[#263238] text-white rounded-xl shadow-sm font-bold text-xs cursor-pointer transition-colors"
          @click="openMarketModal"
        >
          <span class="text-sm">🏪</span>
          <span>Chợ cá</span>
          <span v-if="marketListings.length" class="px-1.5 py-0.2 bg-amber-400 text-gray-900 rounded-full text-[10px] font-extrabold ml-0.5">
            {{ marketListings.length }}
          </span>
        </button>
      </div>
    </div>

    <!-- Market Modal Dialog -->
    <div v-if="isMarketOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div class="w-full max-w-4xl max-h-[85vh] bg-white border-2 border-[#263238] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden relative">
        
        <!-- Header -->
        <div class="px-6 py-4 bg-[#153221] text-white flex items-center justify-between border-b border-emerald-800 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-700/60 border border-emerald-500/40 grid place-items-center text-xl shadow-inner">
              🏪
            </div>
            <div>
              <h2 class="m-0 text-lg font-extrabold tracking-wide">Chợ Cá - Sàn Giao Dịch</h2>
              <p class="m-0 text-xs text-emerald-200">Mua bán, giao dịch cá quý hiếm giữa các cần thủ</p>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <!-- Số tiền người dùng -->
            <div class="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-amber-300 font-bold text-sm">
              <span>💰</span>
              <span>{{ currencyStore.formattedCash }} đ</span>
            </div>

            <button type="button"
              class="w-8 h-8 rounded-full border border-emerald-600/50 bg-emerald-900/50 text-white hover:bg-emerald-800 font-bold text-lg flex items-center justify-center cursor-pointer transition-colors"
              @click="isMarketOpen = false">
              &times;
            </button>
          </div>
        </div>

        <!-- Navigation Tabs & Utility Toolbar -->
        <div class="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <!-- Tabs -->
          <div class="flex items-center bg-gray-200/80 p-1 rounded-xl gap-1 text-xs font-bold">
            <button type="button"
              class="px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              :class="activeMarketTab === 'all' ? 'bg-white text-[#153221] shadow-xs font-extrabold' : 'text-gray-600 hover:text-gray-900'"
              @click="activeMarketTab = 'all'">
              <span>🛒 Sàn giao dịch</span>
              <span class="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                {{ marketListings.length }}
              </span>
            </button>
            <button type="button"
              class="px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              :class="activeMarketTab === 'my' ? 'bg-white text-[#153221] shadow-xs font-extrabold' : 'text-gray-600 hover:text-gray-900'"
              @click="activeMarketTab = 'my'">
              <span>📦 Cá của tôi đang bán</span>
              <span class="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                {{ myMarketListings.length }}
              </span>
            </button>
          </div>

          <!-- Quick Refresh Button -->
          <button type="button" @click="loadMarketListings" title="Làm mới danh sách"
            class="px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors">
            <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoadingMarket }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Làm mới</span>
          </button>
        </div>

        <!-- Filter & Search Toolbar (shown for 'all' tab) -->
        <div v-if="activeMarketTab === 'all'" class="px-6 py-2.5 bg-white border-b border-gray-100 flex flex-wrap items-center gap-3 flex-shrink-0">
          <!-- Search input -->
          <div class="relative flex-1 min-w-[200px]">
            <input v-model="marketSearch" type="text" placeholder="Tìm kiếm cá rao bán..."
              class="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#153221] bg-gray-50/70" />
            <svg class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <!-- Rarity filter -->
          <div class="flex items-center gap-1 text-xs">
            <span class="text-gray-500 font-medium text-[11px]">Độ hiếm:</span>
            <select v-model="marketRarity" class="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:outline-none">
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
            <select v-model="marketSort" class="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:outline-none">
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
            <div v-if="isLoadingMarket" class="py-16 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
              <div class="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
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
                    
                    <span class="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-extrabold rounded border uppercase shadow-xs backdrop-blur-xs"
                      :class="getRarityBadgeClass(item.caught?.fish?.rarity)">
                      {{ item.caught?.fish?.rarity }}
                    </span>

                    <!-- Badge nếu là cá của bản thân -->
                    <span v-if="item.user_id === authStore.user?.id" class="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-white font-extrabold text-[9px] rounded shadow-xs">
                      Cá của bạn
                    </span>
                  </div>

                  <!-- Thông tin chi tiết -->
                  <div class="flex flex-col gap-1 mb-3">
                    <h4 class="m-0 font-bold text-sm text-[#263238] truncate">{{ item.caught?.fish?.name }}</h4>
                    <div class="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                      <span>⚖️ {{ typeof item.caught?.fish?.weight === 'number' ? item.caught.fish.weight + ' kg' : item.caught?.fish?.weight }}</span>
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
                    <span class="text-sm font-extrabold text-amber-600">{{ item.price.toLocaleString('vi-VN') }} đ</span>
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
              <p class="mt-1 text-gray-400">Chọn cá trong danh sách túi đồ bên phải và nhấn nút <strong>"Bán"</strong> để rao bán cá.</p>
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div v-for="item in myMarketListings" :key="item.id"
                class="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs flex flex-col justify-between">
                
                <div>
                  <div class="relative w-full h-32 rounded-lg overflow-hidden bg-gray-100 mb-2 border border-gray-100">
                    <img :src="item.caught?.fish?.image || '/fish/VN/fish.jpg'" :alt="item.caught?.fish?.name"
                      class="w-full h-full object-cover" />
                    
                    <span class="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-extrabold rounded border uppercase shadow-xs"
                      :class="getRarityBadgeClass(item.caught?.fish?.rarity)">
                      {{ item.caught?.fish?.rarity }}
                    </span>
                  </div>

                  <div class="flex flex-col gap-1 mb-3">
                    <h4 class="m-0 font-bold text-sm text-[#263238] truncate">{{ item.caught?.fish?.name }}</h4>
                    <div class="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                      <span>⚖️ {{ typeof item.caught?.fish?.weight === 'number' ? item.caught.fish.weight + ' kg' : item.caught?.fish?.weight }}</span>
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
                    <span class="text-sm font-extrabold text-amber-600">{{ item.price.toLocaleString('vi-VN') }} đ</span>
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
    <div v-if="itemToBuy" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs" @click.self="cancelBuy">
      <div class="w-full max-w-sm bg-white border-2 border-[#263238] rounded-xl p-5 shadow-[0_12px_32px_rgba(38,50,56,0.3)] text-center relative">
        <h3 class="m-0 text-base font-bold text-[#263238]">Xác nhận mua cá</h3>
        
        <div class="my-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-left">
          <img :src="itemToBuy.caught?.fish?.image || '/fish/VN/fish.jpg'" class="w-12 h-12 rounded-lg object-cover border border-emerald-300" />
          <div class="flex-1 min-w-0">
            <h4 class="m-0 text-xs font-bold text-[#263238] truncate">{{ itemToBuy.caught?.fish?.name }}</h4>
            <div class="text-[11px] text-amber-700 font-extrabold mt-0.5">{{ itemToBuy.price.toLocaleString('vi-VN') }} đ</div>
          </div>
        </div>

        <p class="text-xs text-gray-600 leading-relaxed mb-4">
          Số tiền hiện có của bạn: <strong class="text-amber-600">{{ currencyStore.formattedCash }} đ</strong>
        </p>

        <p v-if="buyError" class="mb-3 text-[11px] text-red-500 font-medium bg-red-50 p-2 rounded border border-red-200">{{ buyError }}</p>

        <div class="flex justify-center gap-3">
          <button type="button" class="py-1.5 px-4 rounded-lg border border-[#263238] bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1]" @click="cancelBuy">
            Hủy
          </button>
          <button type="button" class="py-1.5 px-4 rounded-lg border border-[#153221] bg-[#153221] text-white text-xs font-bold cursor-pointer hover:bg-[#1a3e29] shadow-sm disabled:opacity-50" :disabled="isBuying" @click="handleBuyFish">
            {{ isBuying ? 'Đang giao dịch...' : 'Xác nhận mua' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="hoveredTitle" class="tooltip" :style="{ top: tooltipPos.y + 'px', left: tooltipPos.x + 'px' }">
      {{ hoveredTitle }}
    </div>

    <!-- Dialog xem thông tin cá nhân -->
    <div v-if="isProfileOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        class="w-full max-w-md bg-white border-2 border-[#263238] rounded-xl p-5 shadow-[0_12px_32px_rgba(38,50,56,0.25)] relative">
        <div class="flex items-center justify-between border-b border-[#d5ddda] pb-3 mb-4">
          <h3 class="m-0 text-base font-bold text-[#263238]">Thông tin tài khoản</h3>
          <button type="button"
            class="border-0 bg-transparent text-[#263238] hover:text-[#d84315] font-bold text-xl cursor-pointer leading-none px-1"
            @click="isProfileOpen = false">
            &times;
          </button>
        </div>

        <div class="flex flex-col gap-3 text-xs text-[#263238]">
          <div class="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span class="text-gray-500 font-medium">Email</span>
            <span class="font-bold">{{ authStore.user?.email || "Chưa cập nhật" }}</span>
          </div>
          <div class="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span class="text-gray-500 font-medium">User ID</span>
            <span class="font-mono text-[11px] bg-gray-100 px-2 py-0.5 rounded">{{ authStore.user?.id || "N/A" }}</span>
          </div>
          <div class="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span class="text-gray-500 font-medium">Số tiền hiện tại</span>
            <span class="font-bold text-amber-600 text-sm">{{ currencyStore.formattedCash }} đ</span>
          </div>
        </div>

        <div class="mt-5 flex justify-end">
          <button type="button"
            class="py-1.5 px-4 rounded-lg border border-[#263238] bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1]"
            @click="isProfileOpen = false">
            Đóng
          </button>
        </div>
      </div>
    </div>

    <!-- Dialog xác nhận thả cá -->
    <div v-if="fishToRelease"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      @click.self="cancelRelease">
      <div
        class="w-full max-w-sm bg-white border-2 border-[#263238] rounded-xl p-5 shadow-[0_12px_32px_rgba(38,50,56,0.3)] text-center relative">
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
            class="py-1.5 px-4 rounded-lg border border-[#263238] bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1]"
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
    <div v-if="fishToSell"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      @click.self="cancelSell">
      <div
        class="w-full max-w-sm bg-white border-2 border-[#263238] rounded-xl p-5 shadow-[0_12px_32px_rgba(38,50,56,0.3)] text-center relative">
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
            class="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#153221]"
            @keyup.enter="handleSell" />
          <p v-if="sellError" class="mt-1 text-[11px] text-red-500 font-medium">{{ sellError }}</p>
        </div>

        <div class="flex justify-center gap-3 mt-5">
          <button type="button"
            class="py-1.5 px-4 rounded-lg border border-[#263238] bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1]"
            @click="cancelSell">
            Hủy
          </button>
          <button type="button"
            class="py-1.5 px-4 rounded-lg border border-[#153221] bg-[#153221] text-white text-xs font-bold cursor-pointer hover:bg-[#1a3e29] shadow-sm disabled:opacity-50"
            :disabled="isSelling" @click="handleSell">
            {{ isSelling ? 'Đang bán...' : 'Xác nhận bán' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="css">
.anchor-toggle input {
  position: absolute;
  opacity: 0;
}

.toggle-track {
  width: 38px;
  height: 22px;
  border-radius: 11px;
  background: #b0bec5;
  transition: background 120ms ease-out;
}

.toggle-track::after {
  display: block;
  width: 18px;
  height: 18px;
  margin: 2px;
  border-radius: 50%;
  background: #ffffff;
  content: "";
  transition: transform 120ms ease-out;
}

.anchor-toggle input:checked+.toggle-track {
  background: #d84315;
}

.anchor-toggle input:checked+.toggle-track::after {
  transform: translateX(16px);
}

.map-anchor {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #d84315;
  box-shadow: 0 1px 5px rgba(38, 50, 56, 0.55);
  pointer-events: none;
  z-index: 1;
}

.map-frame {
  flex: 0 0 500px;
  width: 500px;
  height: 500px;
}

.map-anchor span {
  position: absolute;
  top: 15px;
  left: 50%;
  padding: 3px 6px;
  border-radius: 4px;
  background: rgba(38, 50, 56, 0.9);
  color: #ffffff;
  font-size: 11px;
  white-space: nowrap;
  transform: translateX(-50%);
}

path {
  fill: #153221;
  stroke: white;
  stroke-width: 0.01rem !important;
}

path:hover {
  fill: #aab330b2 !important;
}

.tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
}

@media (max-width: 1024px) {
  .map-page {
    height: auto;
    min-height: 100vh;
    flex-direction: column;
    overflow: auto;
  }

  .map-sidebar,
  .caught-sidebar {
    width: 100%;
    flex-basis: auto;
    height: 350px;
  }

  .map-frame {
    min-height: 50vh;
  }
}
</style>
