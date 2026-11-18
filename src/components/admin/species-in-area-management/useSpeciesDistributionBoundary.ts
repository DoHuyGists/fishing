import { computed, ref, type Ref } from 'vue';
import type { SpeciesBoundaryShape, SpeciesDistributionBoundary, SpeciesBoundaryPoint } from '../../../types/table/speciesInArea';
import { clampBoundary, cloneBoundary, createSpeciesBoundary, speciesBoundaryPolygon, validSpeciesBoundary } from '../../../utils/speciesDistributionBoundary';

export function useSpeciesDistributionBoundary(
  getBoundary: () => SpeciesDistributionBoundary,
  svgRef: Ref<SVGSVGElement | null>,
  update: (boundary: SpeciesDistributionBoundary) => void,
) {
  const editing = ref(false);
  const selectedNode = ref<number | null>(null);
  const drag = ref<{ kind: 'node' | 'width' | 'height'; index: number; pointerId: number } | null>(null);
  const boundary = computed(getBoundary);
  const locked = computed(() => boundary.value.shape === 'circle' || boundary.value.shape === 'square');
  const rightHandle = computed(() => ({ x: 300 + boundary.value.width / 2, y: 200 }));
  const bottomHandle = computed(() => ({ x: 300, y: 200 + boundary.value.height / 2 }));

  function apply(next: SpeciesDistributionBoundary) {
    if (validSpeciesBoundary(next)) update(next);
  }
  function preset(shape: SpeciesBoundaryShape, random = false) {
    selectedNode.value = null;
    apply(createSpeciesBoundary(shape, random));
  }
  function resize(axis: 'width' | 'height', value: number) {
    const next = cloneBoundary(boundary.value);
    if (locked.value) next.width = next.height = clampBoundary(value, 160, 340);
    else next[axis] = clampBoundary(value, axis === 'width' ? 160 : 120, axis === 'width' ? 540 : 340);
    apply(next);
  }
  function insertNode(index?: number) {
    const next = cloneBoundary(boundary.value);
    if (next.shape !== 'natural' || next.nodes.length >= 24) return;
    if (index === undefined) {
      let longest = -1;
      for (let i = 0; i < next.nodes.length; i++) {
        const a = next.nodes[i]!, b = next.nodes[(i + 1) % next.nodes.length]!;
        const length = Math.hypot(a.x - b.x, a.y - b.y);
        if (length > longest) { longest = length; index = i; }
      }
    }
    const point = speciesBoundaryPolygon(next)[index! * 8 + 4]!;
    next.nodes.splice(index! + 1, 0, { ...point });
    apply(next);
    selectedNode.value = null;
  }
  function removeNode() {
    if (selectedNode.value === null || boundary.value.nodes.length <= 6) return;
    const next = cloneBoundary(boundary.value);
    next.nodes.splice(selectedNode.value, 1);
    apply(next);
    selectedNode.value = null;
  }
  function toSvg(event: MouseEvent): SpeciesBoundaryPoint | null {
    const matrix = svgRef.value?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }
  function startDrag(kind: 'node' | 'width' | 'height', index: number, event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    selectedNode.value = kind === 'node' ? index : null;
    drag.value = { kind, index, pointerId: event.pointerId };
    svgRef.value?.setPointerCapture(event.pointerId);
  }
  function onMove(event: PointerEvent) {
    const current = drag.value;
    if (!current || current.pointerId !== event.pointerId) return;
    const point = toSvg(event);
    if (!point) return;
    if (current.kind === 'node') {
      const next = cloneBoundary(boundary.value);
      next.nodes[current.index] = { x: clampBoundary(point.x, 40, 560), y: clampBoundary(point.y, 40, 360) };
      apply(next);
    } else resize(current.kind, Math.abs(point[current.kind === 'width' ? 'x' : 'y'] - (current.kind === 'width' ? 300 : 200)) * 2);
  }
  function endDrag(event: PointerEvent) {
    if (drag.value?.pointerId !== event.pointerId) return;
    drag.value = null;
    if (svgRef.value?.hasPointerCapture(event.pointerId)) svgRef.value.releasePointerCapture(event.pointerId);
  }
  function doubleClick(event: MouseEvent) {
    if (!editing.value || boundary.value.shape !== 'natural') return;
    const point = toSvg(event);
    if (!point) return;
    const polygon = speciesBoundaryPolygon(boundary.value);
    let nearest = -1, distance = 14;
    polygon.forEach((candidate, i) => {
      const next = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (next < distance) { nearest = i; distance = next; }
    });
    if (nearest >= 0) insertNode(Math.floor(nearest / 8));
  }
  return { editing, selectedNode, locked, rightHandle, bottomHandle, preset, resize, insertNode, removeNode, startDrag, onMove, endDrag, doubleClick };
}
