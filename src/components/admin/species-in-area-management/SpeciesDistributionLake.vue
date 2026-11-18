<script setup lang="ts">
import { computed, useId, watch } from 'vue';
import type { SpeciesInAreaRow, SpeciesDistributionBoundary } from '../../../types/table/speciesInArea';
import { useSpeciesDistributionDiagram } from './useSpeciesDistributionDiagram';
import { useSpeciesDistributionBoundary } from './useSpeciesDistributionBoundary';
import SpeciesDistributionBoundaryControls from './SpeciesDistributionBoundaryControls.vue';

const props = defineProps<{
  rows: SpeciesInAreaRow[];
  weights: Record<string, number | null>;
  boundary: SpeciesDistributionBoundary;
  disabled: boolean;
}>();
const emit = defineEmits<{ change: [weights: Record<string, number>]; boundaryChange: [boundary: SpeciesDistributionBoundary] }>();
const clipId = `distribution-lake-${useId()}`;
const { zones, selectedId, selected, selectedRadius, cells, lakePoints, svgRef, sizeHandle, startDrag, onMove, endDrag } = useSpeciesDistributionDiagram(
  () => props.rows, () => props.weights, weights => emit('change', weights), () => props.boundary,
);
const boundaryEditor = useSpeciesDistributionBoundary(() => props.boundary, svgRef, boundary => emit('boundaryChange', boundary));
const { editing, selectedNode, rightHandle, bottomHandle } = boundaryEditor;
watch(selectedId, id => { if (id) selectedNode.value = null; });
watch(selectedNode, index => { if (index !== null) selectedId.value = null; });
watch(editing, () => { selectedNode.value = null; });
const removeNodePosition = computed(() => {
  const node = selectedNode.value === null ? undefined : props.boundary.nodes[selectedNode.value];
  return node ? { x: Math.max(50, Math.min(550, node.x)), y: node.y < 80 ? node.y + 24 : node.y - 38 } : null;
});
const nameOf = (id: string) => props.rows.find(row => row.speciesId === id)?.speciesName || 'Chưa đặt tên';
const percentOf = (id: string) => {
  const total = Object.values(props.weights).reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return total > 0 ? ((props.weights[id] ?? 0) / total * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '0';
};
</script>

<template>
  <div class="min-w-0 flex-1">
    <SpeciesDistributionBoundaryControls
      :boundary="boundary" :editing="editing" :selected-node="selectedNode" :disabled="disabled"
      @preset="boundaryEditor.preset" @resize="boundaryEditor.resize" @toggle="editing = !editing"
      @add="boundaryEditor.insertNode()" @remove="boundaryEditor.removeNode"
    />
    <div class="overflow-hidden rounded-xl border border-[#cbd9c6] bg-[#e5e9d6]" :class="{ 'pointer-events-none opacity-60': disabled }">
      <svg
        ref="svgRef"
        viewBox="0 0 600 400"
        class="block w-full select-none touch-none"
        role="group"
        aria-label="Sơ đồ phân bổ loài; kéo chấm tròn để dời vùng, kéo ô vuông quanh tâm để đổi diện tích"
        @pointermove="onMove($event); boundaryEditor.onMove($event)"
        @pointerup="endDrag($event); boundaryEditor.endDrag($event)"
        @pointercancel="endDrag($event); boundaryEditor.endDrag($event)"
        @lostpointercapture="endDrag($event); boundaryEditor.endDrag($event)"
        @dblclick="boundaryEditor.doubleClick"
        @click="selectedId = null; selectedNode = null"
      >
        <defs><clipPath :id="clipId"><polygon :points="lakePoints" /></clipPath></defs>
        <polygon :points="lakePoints" fill="#d8e8ea" stroke="#f5f9f0" stroke-width="14" stroke-linejoin="round" />
        <g :clip-path="`url(#${clipId})`">
          <polygon
            v-for="(cell, index) in cells"
            :key="cell.id"
            :points="cell.polygon.map(point => `${point.x},${point.y}`).join(' ')"
            :fill="zones[index]?.color"
            stroke="#fff"
            :stroke-width="selectedId === cell.id ? 3 : 1.5"
            class="cursor-pointer transition-opacity hover:opacity-90"
            :class="{ 'opacity-60': selectedId && selectedId !== cell.id }"
            @click.stop="selectedId = selectedId === cell.id ? null : cell.id"
          ><title>{{ nameOf(cell.id) }}: {{ percentOf(cell.id) }}%</title></polygon>
        </g>
        <g v-for="cell in cells.filter(cell => cell.area > 1800)" :key="`label-${cell.id}`" :clip-path="`url(#${clipId})`" class="pointer-events-none" text-anchor="middle">
          <text :x="cell.center.x" :y="cell.center.y - 7" fill="white" stroke="#24352a" stroke-width="3" paint-order="stroke" font-size="11" font-weight="700">
            {{ nameOf(cell.id).length > 18 ? `${nameOf(cell.id).slice(0, 16)}…` : nameOf(cell.id) }}
          </text>
          <text :x="cell.center.x" :y="cell.center.y + 9" fill="white" stroke="#24352a" stroke-width="3" paint-order="stroke" font-size="11">{{ percentOf(cell.id) }}%</text>
        </g>
        <g v-if="!disabled && zones.length > 1">
          <template v-if="selected">
            <circle :cx="selected.seed.x" :cy="selected.seed.y" :r="selectedRadius" fill="none" stroke="white" stroke-width="1.5" stroke-dasharray="5 4" class="pointer-events-none" />
            <line :x1="selected.seed.x" :y1="selected.seed.y" :x2="sizeHandle.x" :y2="sizeHandle.y" stroke="white" stroke-width="1.5" class="pointer-events-none" />
            <rect
              :x="sizeHandle.x - 7" :y="sizeHandle.y - 7" width="14" height="14" rx="2"
              fill="white" :stroke="selected.color" stroke-width="3" class="cursor-nwse-resize"
              :aria-label="`Điều chỉnh bán kính vùng ${nameOf(selected.id)}`"
              @click.stop
              @pointerdown.stop.prevent="startDrag(selected.id, 'size', $event)"
            ><title>Kéo quanh tâm để tăng hoặc giảm diện tích {{ nameOf(selected.id) }}</title></rect>
          </template>
          <circle
            v-for="zone in zones"
            :key="`seed-${zone.id}`"
            :cx="zone.seed.x"
            :cy="zone.seed.y"
            r="8"
            fill="white"
            :stroke="zone.color"
            stroke-width="4"
            class="cursor-grab"
            @click.stop="selectedId = zone.id"
            @pointerdown.stop.prevent="startDrag(zone.id, 'seed', $event)"
          ><title>Dời vùng {{ nameOf(zone.id) }}</title></circle>
        </g>
        <g v-if="editing && !disabled" aria-label="Điểm chỉnh vòng biên">
          <template v-if="boundary.shape === 'natural'">
            <circle
              v-for="(node, index) in boundary.nodes" :key="`boundary-${index}`"
              :cx="node.x" :cy="node.y" :r="selectedNode === index ? 8 : 6"
              :fill="selectedNode === index ? '#047857' : '#24352a'" stroke="white" stroke-width="2"
              class="cursor-move" :aria-label="`Node vòng biên ${index + 1}`"
              @pointerdown.stop.prevent="boundaryEditor.startDrag('node', index, $event)"
              @click.stop
              @dblclick.stop="boundaryEditor.removeNode(index)"
            ><title>Kéo để chỉnh bờ hồ</title></circle>
            <g v-if="removeNodePosition" :transform="`translate(${removeNodePosition.x - 46}, ${removeNodePosition.y})`" role="button" tabindex="0" aria-label="Xóa node đang chọn trên bản đồ" :aria-disabled="boundary.nodes.length <= 6" class="cursor-pointer" @click.stop="boundaryEditor.removeNode()" @keydown.enter.stop.prevent="boundaryEditor.removeNode()" @keydown.space.stop.prevent="boundaryEditor.removeNode()">
              <rect width="92" height="26" rx="13" :fill="boundary.nodes.length > 6 ? '#dc2626' : '#94a3b8'" stroke="white" stroke-width="2" />
              <text x="46" y="17" text-anchor="middle" font-size="12" fill="white" class="pointer-events-none">{{ boundary.nodes.length > 6 ? 'Xóa node' : 'Tối thiểu 6' }}</text>
            </g>
          </template>
          <template v-else>
            <rect :x="rightHandle.x - 5" :y="rightHandle.y - 12" width="10" height="24" rx="4" fill="#24352a" stroke="white" stroke-width="2" class="cursor-ew-resize" aria-label="Kéo chiều rộng vòng biên" @pointerdown.stop.prevent="boundaryEditor.startDrag('width', 0, $event)" />
            <rect :x="bottomHandle.x - 12" :y="bottomHandle.y - 5" width="24" height="10" rx="4" fill="#24352a" stroke="white" stroke-width="2" class="cursor-ns-resize" aria-label="Kéo chiều cao vòng biên" @pointerdown.stop.prevent="boundaryEditor.startDrag('height', 0, $event)" />
          </template>
        </g>
        <text v-if="!zones.length" x="300" y="200" text-anchor="middle" fill="#24352a" font-size="13">Chưa có loài có tỉ trọng lớn hơn 0</text>
      </svg>
    </div>
    <div class="mt-2 text-xs leading-relaxed text-[#24352a]/70">
      Kéo chấm tròn trắng để dời vùng. Chọn vùng rồi kéo ô vuông quanh tâm để đổi bán kính và diện tích.
      Vòng nét đứt thể hiện bán kính ảnh hưởng; diện tích thực tế phụ thuộc vị trí tâm, các vùng lân cận và bờ hồ.
      Bật “Chỉnh vòng biên” để sửa hình dạng hồ. Nút “Lưu phân bổ” lưu cả tỉ trọng và vòng biên.
    </div>
  </div>
</template>
