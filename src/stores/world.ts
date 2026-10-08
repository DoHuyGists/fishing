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
    zoomable: true,
    isZooming: true,
    isAnchorMode: false,
    anchorable: true,
    pan: { x: 0, y: 0 },
    isDragging: false,
    didDrag: false,
    dragable: true,
    selectedCoordinate: null as { x: number; y: number } | null,
    selectedCountry: null as { id: string; title: string } | null,
  }),
  getters: {},
  actions: {
    resetDefault() {
      this.isAnchorMode = false;
      this.dragable = true;
      this.zoomable = true;
      this.anchorable = true;
      this.selectedCountry = null;
      this.selectedCoordinate = null;
    },

    disabledInteraction() {
      this.isAnchorMode = false;
      this.dragable = false;
      this.anchorable = false;
      this.zoomable = false;
    },

    enableInteraction() {
      this.dragable = true;
      this.anchorable = true;
      this.zoomable = true;
    },

    getCurrentArea() {
      return {
        zoom: this,
        pan: this.pan,
      };
    },
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

    resetSelectedCoordinate() {
      this.selectedCoordinate = null;
    },

    resetSelectedCountry() {
      this.selectedCountry = null;
    },

    setWorldSelectedCoordinate(position: { x: number; y: number }) {
      if (this.didDrag) {
        this.didDrag = false;
        return;
      }
      this.selectedCoordinate = position;
    },

    setCountrySelected(country: { id: string; title: string }) {
      this.selectedCountry = country;
    },

    toggleAnchorMode(){
      this.isAnchorMode = !this.isAnchorMode;
    }
  },
});
