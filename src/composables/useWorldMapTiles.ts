import { onBeforeUnmount, onMounted } from "vue";
import type { WorldMapTileManifest, WorldMapTileViewport, WorldMapTileMode } from "../types/model/worldMap";

export function useWorldMapTiles(redraw: () => void, getMode: () => WorldMapTileMode = () => 'none') {
  const baseUrl = `${import.meta.env.BASE_URL}world-map-tiles/`;
  const images = new Map<string, HTMLImageElement>();
  const pending = new Map<string, HTMLImageElement>();
  const failed = new Set<string>();
  const required = new Set<string>();
  const fadeStartedAt = new Map<string, number>();
  const fadeDuration = 350;
  let previousTargetZoom: number | null = null;
  let reducedMotion = false;
  let debugViewport: WorldMapTileViewport | null = null;
  let debugSummary = '';
  let debugCells: { x: number; y: number; width: number; height: number; label: string; color: string }[] = [];
  const controller = new AbortController();
  let manifest: WorldMapTileManifest | null = null;
  let queue: string[] = [];
  let frame = 0;
  let disposed = false;
  let fallback: HTMLImageElement | null = null;
  let manifestFailed = false;

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
    fallback.src = `${import.meta.env.BASE_URL}world_map.jpg`;
  }

  function pump() {
    while (!disposed && pending.size < 6 && queue.length) {
      const key = queue.shift()!;
      if (images.has(key) || pending.has(key) || failed.has(key)) continue;
      const image = new Image();
      pending.set(key, image);
      image.decoding = "async";
      image.onload = () => {
        pending.delete(key);
        if (disposed) return;
        images.set(key, image);
        // Keep the visible working set, even on unusually large/HiDPI viewports.
        while (images.size > 96) {
          const oldest = [...images.keys()].find((key) => !required.has(key));
          if (!oldest) break;
          images.delete(oldest);
          fadeStartedAt.delete(oldest);
        }
        scheduleDraw();
        pump();
      };
      image.onerror = () => {
        pending.delete(key);
        if (disposed) return;
        failed.add(key);
        loadFallback();
        scheduleDraw();
        pump();
      };
      image.src = `${baseUrl}${key}`;
    }
  }

  onMounted(async () => {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      const response = await fetch(`${baseUrl}manifest.json`, { signal: controller.signal });
      if (!response.ok) throw new Error("Tile manifest unavailable");
      const data = (await response.json()) as WorldMapTileManifest;
      if (
        data.projection !== "equirectangular" ||
        !(data.tileSize > 0) ||
        typeof data.template !== "string" ||
        !data.levels?.length ||
        data.levels.some(
          (level) =>
            ![level.width, level.height, level.columns, level.rows].every(
              (value) => Number.isFinite(value) && value > 0,
            ),
        )
      ) {
        throw new Error("Invalid tile manifest");
      }
      if (disposed) return;
      manifest = { ...data, levels: [...data.levels].sort((a, b) => a.width - b.width) };
      scheduleDraw();
    } catch {
      manifestFailed = true;
      if (!disposed) loadFallback();
    }
  });

  function draw(context: CanvasRenderingContext2D, viewport: WorldMapTileViewport) {
    debugViewport = viewport;
    debugCells = [];
    debugSummary = manifest ? '' : manifestFailed ? 'manifest: failed | fallback' : 'manifest: loading';
    const {
      bounds: [[left, top], [right, bottom]],
      width,
      height,
      dpr,
      transform,
    } = viewport;
    const mapWidth = right - left;
    const mapHeight = bottom - top;
    if (mapWidth <= 0 || mapHeight <= 0 || width <= 0 || height <= 0) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    if (fallback?.complete && fallback.naturalWidth) {
      context.drawImage(fallback, left, top, mapWidth, mapHeight);
    }
    if (!manifest) return;

    const { levels, tileSize, template } = manifest;
    const desiredWidth = mapWidth * transform.k * dpr;
    const target = levels.find((level) => level.width >= desiredWidth) ?? levels[levels.length - 1]!;
    const now = performance.now();
    if (target.zoom !== previousTargetZoom) {
      // A cached level also needs a visible transition when it becomes the target.
      fadeStartedAt.clear();
      previousTargetZoom = target.zoom;
    }
    let targetTotal = 0;
    let targetDrawn = 0;
    let targetFailed = 0;
    const visibleLeft = Math.max(0, (-transform.x / transform.k - left) / mapWidth);
    const visibleTop = Math.max(0, (-transform.y / transform.k - top) / mapHeight);
    const visibleRight = Math.min(1, ((width - transform.x) / transform.k - left) / mapWidth);
    const visibleBottom = Math.min(1, ((height - transform.y) / transform.k - top) / mapHeight);
    queue = [];
    required.clear();
    if (visibleLeft >= visibleRight || visibleTop >= visibleBottom) return;

    // Shared edges land on physical pixels, avoiding gaps between adjacent tiles.
    const alignX = (x: number) => (Math.round((x * transform.k + transform.x) * dpr) / dpr - transform.x) / transform.k;
    const alignY = (y: number) => (Math.round((y * transform.k + transform.y) * dpr) / dpr - transform.y) / transform.k;
    for (const level of levels) {
      if (level.width > target.width) break;
      const startX = Math.floor((visibleLeft * level.width) / tileSize);
      const startY = Math.floor((visibleTop * level.height) / tileSize);
      const endX = Math.min(level.columns, Math.ceil((visibleRight * level.width) / tileSize));
      const endY = Math.min(level.rows, Math.ceil((visibleBottom * level.height) / tileSize));
      for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
          const key = template.replace("{z}", String(level.zoom)).replace("{x}", String(x)).replace("{y}", String(y));
          if (level === levels[0] || level === target) required.add(key);
          const image = images.get(key);
          if (level === target) {
            targetTotal++;
            if (image) targetDrawn++;
            if (failed.has(key)) targetFailed++;
            if (getMode() === 'admin') {
              const state = image ? 'target' : failed.has(key) ? 'failed' : 'loading';
              debugCells.push({
                x: (left + x * tileSize / level.width * mapWidth) * transform.k + transform.x,
                y: (top + y * tileSize / level.height * mapHeight) * transform.k + transform.y,
                width: Math.min(tileSize, level.width - x * tileSize) / level.width * mapWidth * transform.k,
                height: Math.min(tileSize, level.height - y * tileSize) / level.height * mapHeight * transform.k,
                label: `${level.zoom}/${x}/${y} ${state}`,
                color: image ? '#4ade80' : failed.has(key) ? '#f87171' : '#fbbf24',
              });
            }
          }
          if (image) {
            images.delete(key);
            images.set(key, image);
            const x0 = alignX(left + ((x * tileSize) / level.width) * mapWidth);
            const y0 = alignY(top + ((y * tileSize) / level.height) * mapHeight);
            const x1 = alignX(left + (Math.min((x + 1) * tileSize, level.width) / level.width) * mapWidth);
            const y1 = alignY(top + (Math.min((y + 1) * tileSize, level.height) / level.height) * mapHeight);
            if (getMode() === 'admin' && level !== target) {
              debugCells.unshift({
                x: x0 * transform.k + transform.x,
                y: y0 * transform.k + transform.y,
                width: (x1 - x0) * transform.k,
                height: (y1 - y0) * transform.k,
                label: `${level.zoom}/${x}/${y} base`,
                color: '#60a5fa',
              });
            }
            context.drawImage(image, x0, y0, x1 - x0, y1 - y0);
            if (getMode() === 'player' && !reducedMotion && level === target && level !== levels[0]) {
              // Stagger visible columns from left to right over at most 200 ms.
              const delay = (x - startX) / Math.max(1, endX - startX - 1) * 200;
              if (!fadeStartedAt.has(key)) fadeStartedAt.set(key, now + delay);
              const elapsed = now - fadeStartedAt.get(key)!;
              const progress = Math.max(0, Math.min(1, elapsed / fadeDuration));
              if (elapsed >= 0) {
                context.save();
                context.globalAlpha *= 1 - progress * progress * (3 - 2 * progress);
                context.strokeStyle = '#ffffff';
                context.lineWidth = 1 / transform.k;
                const inset = 0.5 / transform.k;
                context.strokeRect(x0 + inset, y0 + inset, Math.max(0, x1 - x0 - 2 * inset), Math.max(0, y1 - y0 - 2 * inset));
                context.restore();
              }
              if (progress < 1) scheduleDraw();
            }
          } else if (level === levels[0] || level === target) {
            // Low-resolution tiles cover the map while the chosen level loads.
            queue.push(key);
          }
        }
      }
    }
    debugSummary = `z=${target.zoom} | drawn=${targetDrawn}/${targetTotal} | failed=${targetFailed} | k=${transform.k.toFixed(2)} | DPR=${dpr.toFixed(2)}`;
    pump();
  }

  // Draw in screen pixels after terrain and fog so diagnostics remain readable.
  function drawDebug(context: CanvasRenderingContext2D) {
    if (getMode() !== 'admin' || !debugViewport) return;
    const { dpr, width, height } = debugViewport;
    context.save();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.beginPath();
    context.rect(0, 0, width, height);
    context.clip();
    context.font = '11px monospace';
    context.textBaseline = 'top';
    context.lineWidth = 1;
    for (const cell of debugCells) {
      context.strokeStyle = cell.color;
      context.strokeRect(cell.x, cell.y, cell.width, cell.height);
      const x = Math.max(4, cell.x + 4);
      const y = Math.max(32, cell.y + 4);
      context.fillStyle = '#111827';
      context.fillRect(x - 2, y - 2, context.measureText(cell.label).width + 4, 16);
      context.fillStyle = cell.color;
      context.fillText(cell.label, x, y);
    }
    context.fillStyle = '#111827';
    context.fillRect(4, 4, Math.min(width - 8, context.measureText(debugSummary).width + 12), 22);
    context.fillStyle = '#ffffff';
    context.fillText(debugSummary, 10, 9, Math.max(1, width - 20));
    context.restore();
  }

  onBeforeUnmount(() => {
    disposed = true;
    controller.abort();
    cancelAnimationFrame(frame);
    for (const image of [...pending.values(), ...(fallback ? [fallback] : [])]) {
      image.onload = image.onerror = null;
      image.removeAttribute("src");
    }
    images.clear();
    fadeStartedAt.clear();
    pending.clear();
    required.clear();
    queue = [];
  });

  return { draw, drawDebug };
}
