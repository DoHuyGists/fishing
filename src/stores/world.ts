import { defineStore } from "pinia";

interface Location {
  zoom: number;
  pan: {
    x: number;
    y: number;
  };
}

const MAP_VIEW_STORAGE_KEY = "worldMapView";
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 40;
export const ZOOM_STEP = 1;

export const useWorldStore = defineStore("world", {
  state: () => ({
    selectedArea: {} as any,
    zoom: 1,
    pan: { x: 0, y: 0 },
    isAnchorMode: false,
    didDrag: false,
    selectedLocation: null as { x: number; y: number } | null,
  }),
  getters: {
    getCurrentlocation: (state) => state.pan,
    getCurrentArea: (state) => ({ zoom: state.zoom, pan: state.pan }),
    getSelectedLocation: (state) => state.selectedLocation,
  },
  actions: {
    cachedMapLocation() {
      localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify({ zoom: this.zoom, pan: this.pan }));
    },

    setMapLocation(location: Location) {
      localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(location));
    },

    targetArea(anchor: any) {
      this.selectedArea = anchor;
    },

    handleMoveToArea(fishingArea: any) {
      this.setMapLocation(fishingArea.location);
      this.moveMapToCachedLocation();
      setTimeout(() => {
        this.targetArea(fishingArea);
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

    resetLocation() {
      this.zoom = MIN_ZOOM;
      this.pan = { x: 0, y: 0 };
      this.handleMoveToArea({});
    },

    resetSelectedLocation(){
      this.selectedLocation = null;
    },

    setWorldClickPosition(position: { x: number; y: number }) {
      if (!this.isAnchorMode || this.didDrag) {
        this.didDrag = false;
        return;
      }
      this.selectedLocation = position;
    },
  },
});
