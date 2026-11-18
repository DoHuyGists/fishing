import { computed, ref, watch } from 'vue';
import type { SpeciesInAreaRow, SpeciesDistributionBoundary } from '../../../types/table/speciesInArea';
import type { DistributionPoint, SpeciesDistributionZone } from '../../../types/model/speciesInArea';
import { distributionCell, distributionWeights, fitDistribution } from '../../../utils/speciesDistribution';
import { insideSpeciesBoundary, pointInSpeciesBoundary, speciesBoundaryPolygon } from '../../../utils/speciesDistributionBoundary';

export function useSpeciesDistributionDiagram(
  getRows: () => SpeciesInAreaRow[],
  getWeights: () => Record<string, number | null>,
  update: (weights: Record<string, number>) => void,
  getBoundary: () => SpeciesDistributionBoundary,
) {
  const zones = ref<SpeciesDistributionZone[]>([]);
  const selectedId = ref<string | null>(null);
  const drag = ref<{ id: string; kind: 'seed' | 'size'; pointerId: number; start: DistributionPoint; seed: DistributionPoint; power: number; total: number } | null>(null);
  const svgRef = ref<SVGSVGElement | null>(null);
  const colors = ['#679e52', '#d38d40', '#438bb0', '#9c6fb0', '#ce737f', '#429b91', '#a29839', '#6579b5'];
  const signature = (weights: Record<string, number | null>) => getRows().map(row => `${row.speciesId}:${weights[row.speciesId]}`).join('|');
  let emittedSignature = '';
  const total = computed(() => Object.values(getWeights()).reduce<number>((sum, value) => sum + (Number.isFinite(value) && value! > 0 ? value! : 0), 0));
  const lake = computed(() => speciesBoundaryPolygon(getBoundary()));
  const cells = computed(() => zones.value.map(zone => distributionCell(zone, zones.value, lake.value)));
  const selected = computed(() => zones.value.find(zone => zone.id === selectedId.value));
  const lakePoints = computed(() => lake.value.map(point => `${point.x},${point.y}`).join(' '));

  watch([() => signature(getWeights()), () => JSON.stringify(getBoundary())], ([value, boundary], previousValues) => {
    if (value === emittedSignature && boundary === previousValues?.[1]) { emittedSignature = ''; return; }
    drag.value = null;
    const previous = new Map(zones.value.map(zone => [zone.id, zone]));
    const count = getRows().length;
    const next = getRows().map((row, i) => previous.get(row.speciesId) ?? {
      id: row.speciesId,
      color: colors[i % colors.length]!,
      seed: { x: 300 + 170 * Math.sqrt((i + 0.5) / count) * Math.cos(i * 2.4), y: 200 + 105 * Math.sqrt((i + 0.5) / count) * Math.sin(i * 2.4) },
      power: 0,
    });
    const used: DistributionPoint[] = [];
    for (const [index, zone] of next.entries()) {
      zone.seed = pointInSpeciesBoundary(zone.seed, lake.value);
      for (let attempt = 0; used.some(seed => Math.hypot(seed.x - zone.seed.x, seed.y - zone.seed.y) < 1) && attempt < 100; attempt++) {
        const angle = (index + attempt) * 2.4;
        const candidate = { x: zone.seed.x + 2 * Math.cos(angle), y: zone.seed.y + 2 * Math.sin(angle) };
        if (insideSpeciesBoundary(candidate, lake.value)) zone.seed = candidate;
      }
      used.push(zone.seed);
    }
    zones.value = fitDistribution(next, getWeights(), lake.value);
  }, { immediate: true });

  function toSvg(event: PointerEvent): DistributionPoint | null {
    const matrix = svgRef.value?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function startDrag(id: string, kind: 'seed' | 'size', event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0 || zones.value.length < 2) return;
    const point = toSvg(event);
    const zone = zones.value.find(zone => zone.id === id);
    if (!zone || !point || !Number.isFinite(total.value)) return;
    selectedId.value = id;
    drag.value = { id, kind, pointerId: event.pointerId, start: point, seed: { ...zone.seed }, power: zone.power, total: total.value };
    svgRef.value?.setPointerCapture(event.pointerId);
  }

  function onMove(event: PointerEvent) {
    const current = drag.value;
    if (!current || current.pointerId !== event.pointerId) return;
    const point = toSvg(event);
    const zone = zones.value.find(zone => zone.id === current.id);
    if (!point || !zone) return;
    if (current.kind === 'size') {
      // A signed power offset can grow even a cell that has been fully covered.
      zone.power = current.power + (point.x - current.start.x) * 500;
    } else {
      const seed = pointInSpeciesBoundary({ x: current.seed.x + point.x - current.start.x, y: current.seed.y + point.y - current.start.y }, lake.value);
      // Distinct seeds prevent coincident cells from claiming the same area.
      if (zones.value.some(other => other.id !== zone.id && Math.hypot(other.seed.x - seed.x, other.seed.y - seed.y) < 2)) return;
      zone.seed = seed;
    }
    const next = distributionWeights(cells.value, current.total);
    emittedSignature = signature({ ...getWeights(), ...next });
    update(next);
  }

  function endDrag(event: PointerEvent) {
    if (drag.value?.pointerId !== event.pointerId) return;
    drag.value = null;
    if (svgRef.value?.hasPointerCapture(event.pointerId)) svgRef.value.releasePointerCapture(event.pointerId);
  }

  const sizeHandle = computed(() => {
    const cell = cells.value.find(cell => cell.id === selectedId.value);
    return { x: Math.max(35, Math.min(565, (cell?.center.x ?? selected.value?.seed.x ?? 300) + 35)), y: Math.max(25, Math.min(375, cell?.center.y ?? selected.value?.seed.y ?? 200)) };
  });

  return { zones, selectedId, selected, cells, lake, lakePoints, svgRef, sizeHandle, startDrag, onMove, endDrag };
}
