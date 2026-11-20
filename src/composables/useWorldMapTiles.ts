import { onBeforeUnmount, onMounted } from 'vue';
import type { WorldMapTileManifest, WorldMapTileViewport } from '../types/model/worldMap';

export function useWorldMapTiles(redraw: () => void) {
  const baseUrl = `${import.meta.env.BASE_URL}world-map-tiles/`;
  const images = new Map<string, HTMLImageElement>();
  const pending = new Map<string, HTMLImageElement>();
  const failed = new Set<string>();
  const required = new Set<string>();
  const controller = new AbortController();
  let manifest: WorldMapTileManifest | null = null;
  let queue: string[] = [];
  let frame = 0;
  let disposed = false;
  let fallback: HTMLImageElement | null = null;

  function scheduleDraw() {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      redraw();
    });
  }

  function loadFallback() {
    if (disposed || fallback) return;
    fallback = new Image();
    fallback.onload = scheduleDraw;
    fallback.src = `${import.meta.env.BASE_URL}HYP_HR_SR_OB_DR.jpg`;
  }

  function pump() {
    while (!disposed && pending.size < 6 && queue.length) {
      const key = queue.shift()!;
      if (images.has(key) || pending.has(key) || failed.has(key)) continue;
      const image = new Image();
      pending.set(key, image);
      image.decoding = 'async';
      image.onload = () => {
        pending.delete(key);
        if (disposed) return;
        images.set(key, image);
        // Keep the visible working set, even on unusually large/HiDPI viewports.
        while (images.size > 96) {
          const oldest = [...images.keys()].find(key => !required.has(key));
          if (!oldest) break;
          images.delete(oldest);
        }
        scheduleDraw();
        pump();
      };
      image.onerror = () => {
        pending.delete(key);
        if (disposed) return;
        failed.add(key);
        loadFallback();
        pump();
      };
      image.src = `${baseUrl}${key}`;
    }
  }

  onMounted(async () => {
    try {
      const response = await fetch(`${baseUrl}manifest.json`, { signal: controller.signal });
      if (!response.ok) throw new Error('Tile manifest unavailable');
      const data = await response.json() as WorldMapTileManifest;
      if (data.projection !== 'equirectangular' || !(data.tileSize > 0)
        || typeof data.template !== 'string' || !data.levels?.length
        || data.levels.some(level => ![level.width, level.height, level.columns, level.rows]
          .every(value => Number.isFinite(value) && value > 0))) {
        throw new Error('Invalid tile manifest');
      }
      if (disposed) return;
      manifest = { ...data, levels: [...data.levels].sort((a, b) => a.width - b.width) };
      scheduleDraw();
    } catch {
      if (!disposed) loadFallback();
    }
  });

  function draw(context: CanvasRenderingContext2D, viewport: WorldMapTileViewport) {
    const { bounds: [[left, top], [right, bottom]], width, height, dpr, transform } = viewport;
    const mapWidth = right - left;
    const mapHeight = bottom - top;
    if (mapWidth <= 0 || mapHeight <= 0 || width <= 0 || height <= 0) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    if (fallback?.complete && fallback.naturalWidth) {
      context.drawImage(fallback, left, top, mapWidth, mapHeight);
    }
    if (!manifest) return;

    const { levels, tileSize, template } = manifest;
    const desiredWidth = mapWidth * transform.k * dpr;
    const target = levels.find(level => level.width >= desiredWidth) ?? levels[levels.length - 1]!;
    const visibleLeft = Math.max(0, ((-transform.x / transform.k) - left) / mapWidth);
    const visibleTop = Math.max(0, ((-transform.y / transform.k) - top) / mapHeight);
    const visibleRight = Math.min(1, (((width - transform.x) / transform.k) - left) / mapWidth);
    const visibleBottom = Math.min(1, (((height - transform.y) / transform.k) - top) / mapHeight);
    queue = [];
    required.clear();
    if (visibleLeft >= visibleRight || visibleTop >= visibleBottom) return;

    // Shared edges land on physical pixels, avoiding gaps between adjacent tiles.
    const alignX = (x: number) => (Math.round((x * transform.k + transform.x) * dpr) / dpr - transform.x) / transform.k;
    const alignY = (y: number) => (Math.round((y * transform.k + transform.y) * dpr) / dpr - transform.y) / transform.k;
    for (const level of levels) {
      if (level.width > target.width) break;
      const startX = Math.floor(visibleLeft * level.width / tileSize);
      const startY = Math.floor(visibleTop * level.height / tileSize);
      const endX = Math.min(level.columns, Math.ceil(visibleRight * level.width / tileSize));
      const endY = Math.min(level.rows, Math.ceil(visibleBottom * level.height / tileSize));
      for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
          const key = template.replace('{z}', String(level.zoom)).replace('{x}', String(x)).replace('{y}', String(y));
          if (level === levels[0] || level === target) required.add(key);
          const image = images.get(key);
          if (image) {
            images.delete(key);
            images.set(key, image);
            const x0 = alignX(left + x * tileSize / level.width * mapWidth);
            const y0 = alignY(top + y * tileSize / level.height * mapHeight);
            const x1 = alignX(left + Math.min((x + 1) * tileSize, level.width) / level.width * mapWidth);
            const y1 = alignY(top + Math.min((y + 1) * tileSize, level.height) / level.height * mapHeight);
            context.drawImage(image, x0, y0, x1 - x0, y1 - y0);
          } else if (level === levels[0] || level === target) {
            // Low-resolution tiles cover the map while the chosen level loads.
            queue.push(key);
          }
        }
      }
    }
    pump();
  }

  onBeforeUnmount(() => {
    disposed = true;
    controller.abort();
    cancelAnimationFrame(frame);
    for (const image of [...pending.values(), ...(fallback ? [fallback] : [])]) {
      image.onload = image.onerror = null;
      image.removeAttribute('src');
    }
    images.clear();
    pending.clear();
    required.clear();
    queue = [];
  });

  return { draw };
}
