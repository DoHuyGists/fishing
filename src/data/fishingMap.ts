export type MapPoint = { x: number; y: number };

// Tọa độ % theo khung cảnh đang hiển thị. Vùng này có thể được tinh chỉnh
// mà không cần thay đổi cơ chế câu cá.
export const waterBoundary: MapPoint[] = [
  { x: 0, y: 51 },
  { x: 5, y: 50 },
  { x: 15, y: 46 },
  { x: 32, y: 46 },
  { x: 50, y: 50 },
  { x: 60, y: 56 },
  { x: 65, y: 61 },
  { x: 75, y: 66 },
  { x: 82, y: 69 },
  { x: 100, y: 77},
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

export function isPointInWater(point: MapPoint) {
  let inside = false;

  for (let current = 0, previous = waterBoundary.length - 1; current < waterBoundary.length; previous = current++) {
    const start = waterBoundary[current];
    const end = waterBoundary[previous];
    const crossesEdge = (start.y > point.y) !== (end.y > point.y)
      && point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x;

    if (crossesEdge) inside = !inside;
  }

  return inside;
}
