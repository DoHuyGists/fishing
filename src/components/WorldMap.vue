<script setup lang="ts">
import { computed, onMounted, watch, ref } from "vue";
import { useFishingAreaStore } from "../stores/fishingArea";
import World from "./World.vue";
import { useWorldStore } from "../stores/world.ts";
import { useCurrencyStore } from "../stores/currency";
import { useAuthStore } from "../stores/auth";
import { supabaseFishRepository } from "../data/supabaseFishRepository";

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
          <button type="button"
            class="px-2.5 py-1.5 border border-red-200 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition-colors cursor-pointer flex-shrink-0 self-center"
            title="Thả cá về lại tự nhiên" @click="openReleaseConfirm(item)">
            Thả
          </button>
        </div>
      </div>
    </aside>

    <div>
      <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm border-2 border-[#263238] hover:bg-white rounded-xl shadow-sm text-[#263238] font-bold text-xs cursor-pointer transition-colors"
          @click="isProfileOpen = true"
        >
          <span>Tài khoản</span>
        </button>
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
