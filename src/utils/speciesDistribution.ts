import type { DistributionPoint, SpeciesDistributionCell, SpeciesDistributionZone } from '../types/model/speciesInArea';

// A convex schematic lake lets weighted power cells cover the lake without gaps.
export const distributionLake: DistributionPoint[] = Array.from({ length: 64 }, (_, i) => {
  const angle = i / 64 * Math.PI * 2;
  const ripple = 1 + 0.025 * Math.sin(3 * angle);
  return { x: 300 + 250 * ripple * Math.cos(angle), y: 200 + 150 * ripple * Math.sin(angle) };
});

function clip(polygon: DistributionPoint[], a: number, b: number, c: number): DistributionPoint[] {
  const result: DistributionPoint[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const start = polygon[i]!;
    const end = polygon[(i + 1) % polygon.length]!;
    const ds = a * start.x + b * start.y - c;
    const de = a * end.x + b * end.y - c;
    if (ds <= 0) result.push(start);
    if ((ds < 0 && de > 0) || (ds > 0 && de < 0)) {
      const t = ds / (ds - de);
      result.push({ x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) });
    }
  }
  return result;
}

// Two reversible shears bend the power diagram without changing area. Adjacent
// cells share the same transform, so their curved edges cannot overlap or gap.
const waveX = (y: number) => 12 * Math.sin(y * 0.021 + 1.3) + 6 * Math.sin(y * 0.047 + 0.4);
const waveY = (x: number) => 12 * Math.sin(x * 0.018 + 2.1) + 6 * Math.sin(x * 0.05 + 3);
export function warpDistributionPoint(point: DistributionPoint): DistributionPoint {
  const x = point.x + waveX(point.y);
  return { x, y: point.y + waveY(x) };
}
export function unwarpDistributionPoint(point: DistributionPoint): DistributionPoint {
  const y = point.y - waveY(point.x);
  return { x: point.x - waveX(y), y };
}

function sampleEdges(polygon: DistributionPoint[], step: number, transform: (point: DistributionPoint) => DistributionPoint): DistributionPoint[] {
  return polygon.flatMap((a, i) => {
    const b = polygon[(i + 1) % polygon.length]!;
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    return Array.from({ length: count }, (_, j) => transform({ x: a.x + (b.x - a.x) * j / count, y: a.y + (b.y - a.y) * j / count }));
  });
}

const lakeCache = new WeakMap<DistributionPoint[], { polygon: DistributionPoint[]; areaScale: number }>();
function warpedLake(lake: DistributionPoint[]) {
  let cached = lakeCache.get(lake);
  if (!cached) {
    const polygon = sampleEdges(lake, 6, warpDistributionPoint);
    cached = { polygon, areaScale: polygonArea(lake) / polygonArea(polygon) };
    lakeCache.set(lake, cached);
  }
  return cached;
}

export function polygonArea(polygon: DistributionPoint[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function powerCell(zone: SpeciesDistributionZone, zones: SpeciesDistributionZone[], lake: DistributionPoint[]): SpeciesDistributionCell {
  let polygon = lake;
  for (const other of zones) {
    if (other.id === zone.id) continue;
    const a = 2 * (other.seed.x - zone.seed.x);
    const b = 2 * (other.seed.y - zone.seed.y);
    const c = other.seed.x ** 2 + other.seed.y ** 2 - zone.seed.x ** 2 - zone.seed.y ** 2 + zone.power - other.power;
    polygon = clip(polygon, a, b, c);
    if (!polygon.length) break;
  }
  const area = polygonArea(polygon);
  let x = 0, y = 0, signedArea = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    const cross = a.x * b.y - b.x * a.y;
    signedArea += cross;
    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
  }
  return { id: zone.id, polygon, area, center: Math.abs(signedArea) > 1e-8 ? { x: x / (3 * signedArea), y: y / (3 * signedArea) } : zone.seed };
}

export function distributionCell(zone: SpeciesDistributionZone, zones: SpeciesDistributionZone[], lake: DistributionPoint[] = distributionLake): SpeciesDistributionCell {
  const domain = warpedLake(lake);
  const warped = zones.map(item => ({ ...item, seed: warpDistributionPoint(item.seed) }));
  const cell = powerCell({ ...zone, seed: warpDistributionPoint(zone.seed) }, warped, domain.polygon);
  return { ...cell, polygon: sampleEdges(cell.polygon, 3, unwarpDistributionPoint), area: cell.area * domain.areaScale, center: unwarpDistributionPoint(cell.center) };
}

// Fit diagram areas to the actual weights, rather than treating influence radii
// as weights. Coordinate descent solves each cell's monotonic area by bisection.
export function fitDistribution(zones: SpeciesDistributionZone[], weights: Record<string, number | null>, lake: DistributionPoint[] = distributionLake): SpeciesDistributionZone[] {
  const active = zones.filter(zone => Number.isFinite(weights[zone.id]) && (weights[zone.id] ?? 0) > 0)
    .map(zone => ({ ...zone, seed: { ...zone.seed } }));
  if (active.length < 2) return active;
  const max = Math.max(...active.map(zone => weights[zone.id]!));
  const sum = active.reduce((total, zone) => total + weights[zone.id]! / max, 0);
  const lakeArea = polygonArea(lake);
  const targets = active.map(zone => weights[zone.id]! / max / sum * lakeArea);
  const domain = warpedLake(lake);
  const warped = active.map(zone => ({ ...zone, seed: warpDistributionPoint(zone.seed) }));
  const areaOf = (index: number) => powerCell(warped[index]!, warped, domain.polygon).area * domain.areaScale;
  for (let pass = 0; pass < 100; pass++) {
    for (let i = 0; i < active.length; i++) {
      const zone = warped[i]!;
      let low = -1e6, high = 1e6;
      for (let step = 0; step < 24; step++) {
        zone.power = (low + high) / 2;
        if (areaOf(i) < targets[i]!) low = zone.power;
        else high = zone.power;
      }
      zone.power = (low + high) / 2;
    }
    // Offsets share an arbitrary additive constant. Keep them bounded.
    const baseline = warped[0]!.power;
    warped.forEach(zone => { zone.power -= baseline; });
    if (warped.every((_, i) => Math.abs(areaOf(i) - targets[i]!) / lakeArea < 0.0002)) break;
  }
  active.forEach((zone, i) => { zone.power = warped[i]!.power; });
  return active;
}

export function distributionWeights(cells: SpeciesDistributionCell[], total: number): Record<string, number> {
  const area = cells.reduce((sum, cell) => sum + cell.area, 0);
  if (!area || !Number.isFinite(total) || total <= 0) return {};
  // Keep the original total (weights are relative, not percentages).
  const weights = Object.fromEntries(cells.map(cell => [cell.id, total * (cell.area / area)]));
  const largest = cells.reduce((a, b) => a.area > b.area ? a : b);
  weights[largest.id]! += total - Object.values(weights).reduce((sum, value) => sum + value, 0);
  return weights;
}
