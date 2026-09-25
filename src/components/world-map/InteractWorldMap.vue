<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, useWorldStore } from '../../stores/world';
import { useFishingAreaStore } from '../../stores/fishingArea';
import World from './World.vue';
import FishingAnchor from './FishingAnchor.vue';
const hoveredTitle = ref("");
const tooltipPos = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const didDrag = ref(false);
const isAnchorMode = ref(false);
const mapFrame = ref<HTMLElement | null>(null);
const dragStart = ref({ x: 0, y: 0 });
const panStart = ref({ x: 0, y: 0 });

const worldStore = useWorldStore();
const fishingAreaStore = useFishingAreaStore();
const anchors = computed(() => fishingAreaStore.areas);

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

  const previousZoom = worldStore.zoom;
  const direction = event.deltaY < 0 ? 1 : -1;
  const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((worldStore.zoom + direction * ZOOM_STEP).toFixed(2))));
  const frameRect = mapFrame.value.getBoundingClientRect();
  const mouseOffset = {
    x: event.clientX - (frameRect.left + frameRect.width / 2),
    y: event.clientY - (frameRect.top + frameRect.height / 2),
  };

  worldStore.pan = {
    x: mouseOffset.x - (nextZoom / previousZoom) * (mouseOffset.x - worldStore.pan.x),
    y: mouseOffset.y - (nextZoom / previousZoom) * (mouseOffset.y - worldStore.pan.y),
  };
  worldStore.zoom = nextZoom;
  clampPan();
}

function clampPan() {
  if (!mapFrame.value) {
    return;
  }

  const { width, height } = mapFrame.value.getBoundingClientRect();
  const maxPanX = (width * (worldStore.zoom - 1)) / 2;
  const maxPanY = (height * (worldStore.zoom - 1)) / 2;

  worldStore.pan = {
    x: Math.min(maxPanX, Math.max(-maxPanX, worldStore.pan.x)),
    y: Math.min(maxPanY, Math.max(-maxPanY, worldStore.pan.y)),
  };
}

function handlePointerDown(event: PointerEvent) {
  const target = event.target as Element | null;
  if (target?.closest(".anchors")) {
    return;
  }

  if (worldStore.zoom === MIN_ZOOM || event.button !== 0 || !mapFrame.value) {
    return;
  }

  isDragging.value = true;
  dragStart.value = { x: event.clientX, y: event.clientY };
  panStart.value = { ...worldStore.pan };
  mapFrame.value.setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent) {
  if (!isDragging.value) {
    return;
  }

  if (Math.hypot(event.clientX - dragStart.value.x, event.clientY - dragStart.value.y) > 3) {
    didDrag.value = true;
  }

  worldStore.pan = {
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

watch([() => worldStore.zoom, () => worldStore.pan], worldStore.cachedMapLocation, { deep: true });

onMounted(() => {
  worldStore.moveMapToCachedLocation();
});
</script>
<template>
  <div class="flex gap-2">
    <FishingAnchor />
    <div class="flex flex-col">
      <div ref="mapFrame"
        class="map-frame flex-1 min-w-0 h-full overflow-hidden border-[1px] mb-0 border-gray-300 rounded-xl bg-[#eef3f1] touch-none relative"
        :class="isDragging ? 'cursor-grabbing' : isAnchorMode ? 'cursor-crosshair' : 'cursor-grab'"
        @wheel.stop="handleWheel" @pointerdown="handlePointerDown" @pointermove="handlePointerMove"
        @pointerup="stopDragging" @pointercancel="stopDragging">
        <div
          class="w-full h-full relative grid place-items-center origin-center transition-transform duration-[120ms] ease-out"
          :class="{ '!transition-none': isDragging }"
          :style="{ transform: `translate(${worldStore.pan.x}px, ${worldStore.pan.y}px) scale(${worldStore.zoom})` }">
          <World class="w-full h-full" @mousemove="handleMouseMove" :anchors="anchors" :zoom="worldStore.zoom" />
        </div>
      </div>
      <div class="space-y-2 mt-4">
        <button type="button"
          class="py-2 px-3 rounded-lg border border-gray-300 bg-transparent text-[#263238] text-xs font-bold cursor-pointer hover:bg-[#eef3f1] transition-colors"
          @click="worldStore.resetZoom">
          Reset zoom
        </button>
        <div class="py-2 px-3 rounded-lg border border-gray-300">
          <div>1. Nhấn giữ Ctrl + cuộn chuột để zoom bản đồ</div>
          <div>2. Nhấn giữ chuột trái + di chuyển chuột để di chuyển bản đồ</div>
        </div>
      </div>
    </div>
  </div>
  <div v-if="hoveredTitle" class="tooltip" :style="{ top: tooltipPos.y + 'px', left: tooltipPos.x + 'px' }">
    {{ hoveredTitle }}
  </div>
</template>
<style lang="css">
.map-frame {
  flex: 0 0 500px;
  width: 500px;
  height: 500px;
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

path {
  fill: #153221;
  stroke: white;
  stroke-width: 0.01rem !important;
}

path:hover {
  fill: #aab330b2 !important;
}

@media (max-width: 1024px) {
  .map-frame {
    min-height: 50vh;
  }
}
</style>