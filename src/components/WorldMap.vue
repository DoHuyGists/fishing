<script setup lang="ts">
import { computed, onMounted, watch, ref } from "vue";
import { useFishingAreaStore } from "../stores/fishingArea";
import World from "./World.vue";

const MAP_VIEW_STORAGE_KEY = "worldMapView";

const hoveredTitle = ref("");
const tooltipPos = ref({ x: 0, y: 0 });
const zoom = ref(1);
const pan = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const didDrag = ref(false);
const isAnchorMode = ref(false);
const mapFrame = ref<HTMLElement | null>(null);
const dragStart = ref({ x: 0, y: 0 });
const panStart = ref({ x: 0, y: 0 });
const fishingAreaStore = useFishingAreaStore();
const anchors = computed(() => fishingAreaStore.areas);

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
  loadMapView();
}

function resetZoom() {
  zoom.value = MIN_ZOOM;
  pan.value = { x: 0, y: 0 };
}

watch([zoom, pan], saveMapView, { deep: true });

onMounted(() => {
  fishingAreaStore.fetchArea();
  loadMapView();
});

const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const ZOOM_STEP = 0.1;

function handleMouseMove(event: any) {
  const targetTitle = event.target.getAttribute("title");

  if (targetTitle) {
    hoveredTitle.value = targetTitle;
    tooltipPos.value = { x: event.clientX + 10, y: event.clientY + 10 };
  } else {
    hoveredTitle.value = "";
  }
}

// function removeAnchor(anchorId: number) {
//   anchors.value = anchors.value.filter((anchor) => anchor.id !== anchorId);
// }

// function clearAnchors() {
//   anchors.value = [];
// }

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
  if (target?.closest("path[title]") || target?.closest(".anchors") || target?.closest(".anchors-hit")) {
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
  <div class="map-page h-screen p-3 relative flex gap-3">
    <aside
      class="map-sidebar w-60 flex-none p-4 border-2 border-[#263238] rounded-xl bg-white text-[#263238] shadow-[0_8px_24px_rgba(38,50,56,0.12)]"
    >
      <div class="flex items-center justify-between">
        <h2 class="m-0 text-lg">Bản đồ</h2>
      </div>

      <button
        type="button"
        class="mt-4 w-full py-2 px-3 rounded-lg border border-[#263238] bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1]"
        @click="resetZoom"
      >
        Reset zoom
      </button>

      <!-- <label
        class="anchor-toggle relative flex items-center justify-between mt-5 py-3 border-t border-b border-[#d5ddda] cursor-pointer"
      >
        <input v-model="isAnchorMode" type="checkbox" class="absolute opacity-0" />
        <span class="toggle-track" aria-hidden="true"></span>
      </label> -->

      <div class="mt-5">
        <div class="flex items-center justify-between text-[13px] font-bold">
          <span>Điểm đã neo</span>
          <!-- <button
            v-if="anchors.length"
            type="button"
            class="border-0 bg-transparent text-[#d84315] cursor-pointer text-xs"
            @click="clearAnchors"
          >
            Hủy tất cả
          </button> -->
        </div>
        <p v-if="!anchors.length" class="mt-[3px] mb-0 text-[#607176] text-xs">Chưa có điểm neo</p>
        <ul v-else class="grid gap-2 p-0 mt-3 mb-0 list-none">
          <li v-for="(anchor, index) in anchors" :key="anchor.id" class="flex items-center gap-2 min-w-0">
            <span class="grid place-items-center w-6 h-6 rounded-full bg-[#d84315] text-white text-xs font-bold">{{
              index + 1
            }}</span>
            <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs">
              <button @click="zoomToArea(anchor)" type="button" class="cursor-pointer">{{ anchor.title }}</button>
            </span>
            <!-- <button
              type="button"
              class="border-0 bg-transparent text-[#d84315] cursor-pointer px-[5px] py-0.5 text-lg leading-none"
              :aria-label="`Hủy điểm neo ${anchor.title}`"
              @click="removeAnchor(anchor.id)"
            >
              ×
            </button> -->
          </li>
        </ul>
      </div>
    </aside>

    <div
      ref="mapFrame"
      class="map-frame flex-1 min-w-0 h-full overflow-hidden border-2 border-[#263238] rounded-xl bg-[#eef3f1] shadow-[0_8px_24px_rgba(38,50,56,0.18)] touch-none"
      :class="isDragging ? 'cursor-grabbing' : isAnchorMode ? 'cursor-crosshair' : 'cursor-grab'"
      @wheel.stop="handleWheel"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="stopDragging"
      @pointercancel="stopDragging"
    >
      <div
        class="w-full h-full relative grid place-items-center origin-center transition-transform duration-[120ms] ease-out"
        :class="{ '!transition-none': isDragging }"
        :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }"
      >
        <World class="w-full h-full" @mousemove="handleMouseMove" :anchors="anchors" :zoom="zoom" />
      </div>
    </div>
    <div v-if="hoveredTitle" class="tooltip" :style="{ top: tooltipPos.y + 'px', left: tooltipPos.x + 'px' }">
      {{ hoveredTitle }}
    </div>

    <!-- <aside
      class="flex flex-col map-sidebar w-100 flex-none p-4 border-2 border-[#263238] rounded-xl bg-white text-[#263238] shadow-[0_8px_24px_rgba(38,50,56,0.12)]"
    >
      <template v-if="targetMapData !== undefined">
        <div class="">
          <h2 class="m-0 text-lg">Thông tin</h2>
          <h6 class="m-0 text-gray-500 underline">{{ targetMapData.name }}</h6>
        </div>
        <div class="overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div v-if="targetMapData.information.length !== 0">{{ targetMapData.information }}</div>
          <div v-else>Chưa có thông tin</div>
        </div>
      </template>
    </aside> -->
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

.anchor-toggle input:checked + .toggle-track {
  background: #d84315;
}

.anchor-toggle input:checked + .toggle-track::after {
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
  stroke-width: 0.02rem !important;
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
  pointer-events: none; /* Tránh cản trở chuột */
}

@media (max-width: 640px) {
  .map-page {
    height: auto;
    min-height: 100vh;
    flex-direction: column;
  }

  .map-sidebar {
    width: auto;
    flex-basis: auto;
  }

  .map-frame {
    min-height: 70vh;
  }
}
</style>
