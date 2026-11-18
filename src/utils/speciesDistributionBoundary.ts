import type { SpeciesBoundaryShape, SpeciesDistributionBoundary, SpeciesBoundaryPoint as Point } from '../types/table/speciesInArea';

export const boundaryShapes: SpeciesBoundaryShape[] = ['natural', 'ellipse', 'circle', 'rect', 'square', 'round', 'hex'];
export const clampBoundary = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const cloneBoundary = (value: SpeciesDistributionBoundary): SpeciesDistributionBoundary => ({
  version: value.version, shape: value.shape, width: value.width, height: value.height,
  nodes: value.nodes.map(point => ({ x: point.x, y: point.y })),
});

export function createSpeciesBoundary(shape: SpeciesBoundaryShape = 'natural', random = false): SpeciesDistributionBoundary {
  const locked = shape === 'circle' || shape === 'square';
  const width = locked ? 320 : 500, height = locked ? 320 : 300;
  const phase = random ? Math.random() * Math.PI * 2 : 0.6;
  const nodes = shape !== 'natural' ? [] : Array.from({ length: 12 }, (_, i) => {
    const angle = i / 12 * Math.PI * 2;
    const scale = random
      ? 0.85 + 0.08 * Math.sin(3 * angle + phase) + 0.06 * Math.cos(2 * angle - phase)
      : (1 + 0.05 * Math.sin(2 * angle + 0.6) + 0.04 * Math.sin(3 * angle + 1.8)) / 1.09;
    return { x: 300 + width / 2 * scale * Math.cos(angle), y: 200 + height / 2 * scale * Math.sin(angle) };
  });
  return { version: 1, shape, width, height, nodes };
}

export function speciesBoundaryPolygon(boundary: SpeciesDistributionBoundary): Point[] {
  const rx = boundary.width / 2, ry = boundary.height / 2;
  const point = (x: number, y: number) => ({ x: 300 + x, y: 200 + y });
  switch (boundary.shape) {
    case 'natural': {
      const nodes = boundary.nodes, count = nodes.length;
      return nodes.flatMap((p1, i) => Array.from({ length: 8 }, (_, step) => {
        const p0 = nodes[(i + count - 1) % count]!, p2 = nodes[(i + 1) % count]!, p3 = nodes[(i + 2) % count]!;
        const t = step / 8;
        const interpolate = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
        return { x: interpolate(p0.x, p1.x, p2.x, p3.x), y: interpolate(p0.y, p1.y, p2.y, p3.y) };
      }));
    }
    case 'circle':
    case 'ellipse':
      return Array.from({ length: 64 }, (_, i) => point(rx * Math.cos(i / 64 * Math.PI * 2), ry * Math.sin(i / 64 * Math.PI * 2)));
    case 'square':
    case 'rect': return [point(-rx, -ry), point(rx, -ry), point(rx, ry), point(-rx, ry)];
    case 'hex': return [point(-rx, 0), point(-rx / 2, -ry), point(rx / 2, -ry), point(rx, 0), point(rx / 2, ry), point(-rx / 2, ry)];
    case 'round': {
      const radius = Math.min(rx, ry) * 0.35;
      return [[rx - radius, -ry + radius, -90], [rx - radius, ry - radius, 0], [-rx + radius, ry - radius, 90], [-rx + radius, -ry + radius, 180]].flatMap(([x, y, angle]) =>
        Array.from({ length: 11 }, (_, i) => point(x! + radius * Math.cos((angle! + i * 9) * Math.PI / 180), y! + radius * Math.sin((angle! + i * 9) * Math.PI / 180))));
    }
  }
}

export function insideSpeciesBoundary(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function pointInSpeciesBoundary(point: Point, polygon: Point[]): Point {
  if (insideSpeciesBoundary(point, polygon)) return point;
  // Choose an interior sample near the requested location, including concave lakes.
  let best = polygon[0]!, distance = Infinity;
  for (let y = 30; y < 380; y += 8) for (let x = 30; x < 580; x += 8) {
    const d = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (d < distance && insideSpeciesBoundary({ x, y }, polygon)) { best = { x, y }; distance = d; }
  }
  return { ...best };
}

export function validSpeciesBoundary(value: unknown): value is SpeciesDistributionBoundary {
  if (!value || typeof value !== 'object') return false;
  const b = value as SpeciesDistributionBoundary;
  if (b.version !== 1 || !boundaryShapes.includes(b.shape) || !Number.isFinite(b.width) || !Number.isFinite(b.height)
    || b.width < 160 || b.width > 540 || b.height < 120 || b.height > 340 || !Array.isArray(b.nodes)
    || ((b.shape === 'circle' || b.shape === 'square') && b.width !== b.height)) return false;
  if (b.shape !== 'natural') return b.nodes.length === 0;
  if (b.nodes.length < 6 || b.nodes.length > 24 || b.nodes.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 40 || p.x > 560 || p.y < 40 || p.y > 360)) return false;
  if (b.nodes.some((point, i) => b.nodes.some((other, j) => j > i && Math.hypot(point.x - other.x, point.y - other.y) < 1))) return false;
  const polygon = speciesBoundaryPolygon(b);
  let area = 0;
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, next = (i + 1) % polygon.length, b = polygon[next]!;
    area += a.x * b.y - b.x * a.y;
    if (a.x < 20 || a.x > 580 || a.y < 20 || a.y > 380) return false;
    for (let j = i + 2; j < polygon.length; j++) {
      if ((j + 1) % polygon.length === i) continue;
      const c = polygon[j]!, d = polygon[(j + 1) % polygon.length]!;
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false;
    }
  }
  return Math.abs(area) / 2 >= 3000;
}

export function storedSpeciesBoundary(rows: { boundary?: unknown }[]): SpeciesDistributionBoundary {
  const stored = rows.find(row => validSpeciesBoundary(row.boundary))?.boundary;
  return validSpeciesBoundary(stored) ? cloneBoundary(stored) : createSpeciesBoundary();
}
