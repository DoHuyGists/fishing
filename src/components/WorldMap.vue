<script setup lang="ts">
import WorldMap from "../assets/world.svg";
import { ref } from "vue";

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
const anchors = ref<Array<{ id: number; x: number; y: number; title: string }>>([]);
let nextAnchorId = 1;

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

function handleMapClick(event: MouseEvent) {
  if (didDrag.value || !isAnchorMode.value) {
    didDrag.value = false;
    return;
  }

  const target = event.target as Element;
  const pointTarget = document.elementFromPoint(event.clientX, event.clientY);
  const titledTarget = target.closest("[title]") ?? pointTarget?.closest("[title]");
  const title = titledTarget?.getAttribute("title");
  const svg = titledTarget?.closest("svg");

  if (!title || !svg) {
    return;
  }

  const svgRect = svg.getBoundingClientRect();
  anchors.value.push({
    id: nextAnchorId++,
    x: ((event.clientX - svgRect.left) / svgRect.width) * 100,
    y: ((event.clientY - svgRect.top) / svgRect.height) * 100,
    title,
  });
}

function removeAnchor(anchorId: number) {
  anchors.value = anchors.value.filter((anchor) => anchor.id !== anchorId);
}

function clearAnchors() {
  anchors.value = [];
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
  <div class="map-page h-screen p-3 relative">
    <aside class="map-sidebar">
      <div class="sidebar-header">
        <h2>Bản đồ</h2>
        <span class="anchor-count">{{ anchors.length }}</span>
      </div>

      <label class="anchor-toggle">
        <span>
          <strong>Tạo điểm neo</strong>
          <small>{{ isAnchorMode ? "Đang bật" : "Đang tắt" }}</small>
        </span>
        <input v-model="isAnchorMode" type="checkbox" />
        <span class="toggle-track" aria-hidden="true"></span>
      </label>

      <div class="anchor-list">
        <div class="list-header">
          <span>Điểm đã neo</span>
          <button v-if="anchors.length" type="button" class="clear-button" @click="clearAnchors">Hủy tất cả</button>
        </div>
        <p v-if="!anchors.length" class="empty-list">Chưa có điểm neo</p>
        <ul v-else>
          <li v-for="(anchor, index) in anchors" :key="anchor.id">
            <span class="anchor-index">{{ index + 1 }}</span>
            <span class="anchor-name">{{ anchor.title }}</span>
            <button
              type="button"
              class="remove-button"
              :aria-label="`Hủy điểm neo ${anchor.title}`"
              @click="removeAnchor(anchor.id)"
            >
              ×
            </button>
          </li>
        </ul>
      </div>
    </aside>

    <div
      ref="mapFrame"
      class="map-frame"
      :class="{ dragging: isDragging, 'anchor-mode': isAnchorMode }"
      @wheel="handleWheel"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="stopDragging"
      @pointercancel="stopDragging"
      @click="handleMapClick"
    >
      <div class="map-content" :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }">
        <WorldMap @mousemove="handleMouseMove" />
        <div
          v-for="(anchor, index) in anchors"
          :key="index"
          class="map-anchor"
          :style="{ left: `${anchor.x}%`, top: `${anchor.y}%` }"
          :title="anchor.title"
        >
          <span>{{ anchor.title }}</span>
        </div>
      </div>
    </div>
    <div v-if="hoveredTitle" class="tooltip" :style="{ top: tooltipPos.y + 'px', left: tooltipPos.x + 'px' }">
      {{ hoveredTitle }}
    </div>
  </div>
</template>

<style lang="css">
.map-frame {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  border: 2px solid #263238;
  border-radius: 12px;
  background: #eef3f1;
  box-shadow: 0 8px 24px rgba(38, 50, 56, 0.18);
  cursor: grab;
  touch-action: none;
}

.map-page {
  display: flex;
  gap: 12px;
}

.map-sidebar {
  width: 240px;
  flex: 0 0 240px;
  padding: 16px;
  border: 2px solid #263238;
  border-radius: 12px;
  background: #ffffff;
  color: #263238;
  box-shadow: 0 8px 24px rgba(38, 50, 56, 0.12);
}

.sidebar-header,
.list-header,
.anchor-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
}

.anchor-count,
.anchor-index {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #d84315;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}

.anchor-toggle {
  position: relative;
  margin-top: 20px;
  padding: 12px 0;
  border-top: 1px solid #d5ddda;
  border-bottom: 1px solid #d5ddda;
  cursor: pointer;
}

.anchor-toggle strong,
.anchor-toggle small {
  display: block;
}

.anchor-toggle small,
.empty-list {
  margin-top: 3px;
  color: #607176;
  font-size: 12px;
}

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

.anchor-list {
  margin-top: 20px;
}

.list-header {
  font-size: 13px;
  font-weight: 700;
}

.clear-button,
.remove-button {
  border: 0;
  background: transparent;
  color: #d84315;
  cursor: pointer;
  font-size: 12px;
}

.anchor-list ul {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 12px 0 0;
  list-style: none;
}

.anchor-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.anchor-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.remove-button {
  padding: 2px 5px;
  font-size: 18px;
  line-height: 1;
}

.empty-list {
  margin-bottom: 0;
}

.map-frame.anchor-mode {
  cursor: crosshair;
}

.map-frame.dragging {
  cursor: grabbing;
}

.map-frame.dragging .map-content {
  transition: none;
}

.map-content {
  width: 100%;
  height: 100%;
  position: relative;
  display: grid;
  place-items: center;
  transform-origin: center;
  transition: transform 120ms ease-out;
}

.map-content svg {
  width: 100%;
  height: 100%;
}

.map-anchor {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #d84315;
  box-shadow: 0 1px 5px rgba(38, 50, 56, 0.55);
  transform: translate(-50%, -50%);
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
  fill: #800080ad;
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
