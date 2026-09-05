export type MapPoint = { x: number; y: number };

export function isPointInWater(point: MapPoint, boundary: any[]) {
  let inside = false;

  for (let current = 0, previous = boundary.length - 1; current < boundary.length; previous = current++) {
    const start = boundary[current];
    const end = boundary[previous];
    const crossesEdge = (start.y > point.y) !== (end.y > point.y)
      && point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x;

    if (crossesEdge) inside = !inside;
  }

  return inside;
}
