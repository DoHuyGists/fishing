import { defineStore } from "pinia";

const MAP_VIEW_STORAGE_KEY = "worldMapView";
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 40;
export const ZOOM_STEP = 1;

export const useWorldStore = defineStore("world", {
  state: () => ({
    selectedArea: {} as any,
    zoom: 1,
    pan: { x: 0, y: 0 }
  }),
  actions: {
    cachedMapLocation() {
      localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify({ zoom: this.zoom, pan: this.pan }));
    },
    setMapLocation(anchor: any) {
      localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(anchor.location));
    },
    targetArea(anchor: any) {
      this.selectedArea = anchor;
    },
    handleMoveToArea(anchor: any) {
      this.setMapLocation(anchor);
      this.moveMapToCachedLocation();
      setTimeout(() => {
        this.targetArea(anchor);
      }, 0);
    },
    moveMapToCachedLocation() {
      // Load cached location
      try {
        const raw = localStorage.getItem(MAP_VIEW_STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (typeof saved?.zoom === "number") {
          this.zoom = saved.zoom;
        }
        if (saved?.pan && typeof saved.pan.x === "number" && typeof saved.pan.y === "number") {
          this.pan = { x: saved.pan.x, y: saved.pan.y };
        }
      } catch {
        // ignore corrupted storage
      }
    },
    resetZoom() {
      this.zoom = MIN_ZOOM;
      this.pan = { x: 0, y: 0 };
      this.handleMoveToArea({});
    }
  },
});
