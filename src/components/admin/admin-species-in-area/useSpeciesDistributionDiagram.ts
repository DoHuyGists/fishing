import { computed, ref, watch } from "vue";
import type { SpeciesInAreaRow, SpeciesDistributionBoundary } from "../../../types/table/speciesInArea";
import type { DistributionPoint, SpeciesDistributionZone } from "../../../types/model/speciesInArea";
import { distributionCell, distributionWeights, fitDistribution } from "../../../utils/speciesDistribution";
import {
  insideSpeciesBoundary,
  pointInSpeciesBoundary,
  speciesBoundaryPolygon,
} from "../../../utils/speciesDistributionBoundary";

export function useSpeciesDistributionDiagram(
  getRows: () => SpeciesInAreaRow[],
  getWeights: () => Record<string, number | null>,
  update: (weights: Record<string, number>) => void,
  getBoundary: () => SpeciesDistributionBoundary,
) {
  const zones = ref<SpeciesDistributionZone[]>([]);
  const selectedId = ref<string | null>(null);
  const radiusAngles = ref<Record<string, number>>({});
  const powerBaseline = ref(0);
  const drag = ref<{
    id: string;
    kind: "seed" | "size";
    pointerId: number;
    start: DistributionPoint;
    seed: DistributionPoint;
    power: number;
    radius: number;
    total: number;
  } | null>(null);
  const svgRef = ref<SVGSVGElement | null>(null);
  const colors = ["#1abc9c", "#ffd166", "#e7ecda", "#a66bff", "#f75353", "#4fc3ff", "#cbd9c6", "#24352a"];
  const signature = (weights: Record<string, number | null>) =>
    getRows()
      .map((row) => `${row.speciesId}:${weights[row.speciesId]}`)
      .join("|");
  let emittedSignature = "";
  const total = computed(() =>
    Object.values(getWeights()).reduce<number>(
      (sum, value) => sum + (Number.isFinite(value) && value! > 0 ? value! : 0),
      0,
    ),
  );
  const lake = computed(() => speciesBoundaryPolygon(getBoundary()));
  const cells = computed(() => zones.value.map((zone) => distributionCell(zone, zones.value, lake.value)));
  const selected = computed(() => zones.value.find((zone) => zone.id === selectedId.value));
  const lakePoints = computed(() => lake.value.map((point) => `${point.x},${point.y}`).join(" "));
  const selectedRadius = computed(() =>
    selected.value ? Math.sqrt(Math.max(0, selected.value.power - powerBaseline.value)) : 70,
  );

  watch(
    [() => signature(getWeights()), () => JSON.stringify(getBoundary())],
    ([value, boundary], previousValues) => {
      if (value === emittedSignature && boundary === previousValues?.[1]) {
        emittedSignature = "";
        return;
      }
      drag.value = null;
      const previous = new Map(zones.value.map((zone) => [zone.id, zone]));
      const count = getRows().length;
      const next = getRows().map(
        (row, i) =>
          previous.get(row.speciesId) ?? {
            id: row.speciesId,
            color: colors[i % colors.length]!,
            seed: {
              x: 300 + 170 * Math.sqrt((i + 0.5) / count) * Math.cos(i * 2.4),
              y: 200 + 105 * Math.sqrt((i + 0.5) / count) * Math.sin(i * 2.4),
            },
            power: 0,
          },
      );
      const used: DistributionPoint[] = [];
      for (const [index, zone] of next.entries()) {
        zone.seed = pointInSpeciesBoundary(zone.seed, lake.value);
        for (
          let attempt = 0;
          used.some((seed) => Math.hypot(seed.x - zone.seed.x, seed.y - zone.seed.y) < 1) && attempt < 100;
          attempt++
        ) {
          const angle = (index + attempt) * 2.4;
          const candidate = { x: zone.seed.x + 2 * Math.cos(angle), y: zone.seed.y + 2 * Math.sin(angle) };
          if (insideSpeciesBoundary(candidate, lake.value)) zone.seed = candidate;
        }
        used.push(zone.seed);
      }
      zones.value = fitDistribution(next, getWeights(), lake.value);
      // Power offsets are relative. Use one common baseline for every region,
      // and derive each displayed radius from its actual fitted influence.
      powerBaseline.value = Math.min(0, ...zones.value.map((zone) => zone.power)) - 70 ** 2;
      if (!zones.value.some((zone) => zone.id === selectedId.value)) selectedId.value = null;
    },
    { immediate: true },
  );

  function toSvg(event: PointerEvent): DistributionPoint | null {
    const matrix = svgRef.value?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function startDrag(id: string, kind: "seed" | "size", event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0 || zones.value.length < 2) return;
    const point = toSvg(event);
    const zone = zones.value.find((zone) => zone.id === id);
    if (!zone || !point || !Number.isFinite(total.value)) return;
    selectedId.value = id;
    drag.value = {
      id,
      kind,
      pointerId: event.pointerId,
      start: point,
      seed: { ...zone.seed },
      power: zone.power,
      radius: selectedRadius.value,
      total: total.value,
    };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  function onMove(event: PointerEvent) {
    const current = drag.value;
    if (!current || current.pointerId !== event.pointerId) return;
    const point = toSvg(event);
    const zone = zones.value.find((zone) => zone.id === current.id);
    if (!point || !zone) return;
    if (current.kind === "size") {
      const dx = point.x - zone.seed.x,
        dy = point.y - zone.seed.y;
      const radius = Math.max(15, Math.min(Math.max(260, current.radius + 70), Math.hypot(dx, dy)));
      radiusAngles.value[zone.id] = Math.atan2(dy, dx);
      // Power is defined up to a shared offset; apply the radius-squared delta
      // to preserve the fitted weights when the radius handle is first grabbed.
      zone.power = current.power + radius ** 2 - current.radius ** 2;
    } else {
      const seed = pointInSpeciesBoundary(
        { x: current.seed.x + point.x - current.start.x, y: current.seed.y + point.y - current.start.y },
        lake.value,
      );
      // Distinct seeds prevent coincident cells from claiming the same area.
      if (
        zones.value.some(
          (other) => other.id !== zone.id && Math.hypot(other.seed.x - seed.x, other.seed.y - seed.y) < 2,
        )
      )
        return;
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
    const seed = selected.value?.seed ?? { x: 300, y: 200 };
    const angle = selected.value
      ? (radiusAngles.value[selected.value.id] ?? Math.atan2(200 - seed.y, 300 - seed.x))
      : 0;
    return { x: seed.x + selectedRadius.value * Math.cos(angle), y: seed.y + selectedRadius.value * Math.sin(angle) };
  });

  return {
    zones,
    selectedId,
    selected,
    selectedRadius,
    cells,
    lake,
    lakePoints,
    svgRef,
    sizeHandle,
    startDrag,
    onMove,
    endDrag,
  };
}
