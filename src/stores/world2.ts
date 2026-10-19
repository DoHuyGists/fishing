import { defineStore } from "pinia";

interface Location {
  k: number;
  lon: number;
  lat: number;
}

const MAP_VIEW_STORAGE_KEY = "world2MapView";
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 40;
export const ZOOM_STEP = 1;

export const useWorld2Store = defineStore("world2", {
  state: () => ({
    selectedArea: {} as any,
    k: 1,
    lon: 0,
    lat: 0,
    zoomable: true,
    isZooming: true,
    isAnchorMode: false,
    anchorable: true,
    selectedCoordinate: null as { x: number; y: number } | null,
    selectedCountry: null as { id: string; title: string } | null,
    showAnchorSelectButton: false,
  }),
  getters: {},
  actions: {
    resetDefault() {
      this.isAnchorMode = false;
      this.zoomable = true;
      this.anchorable = true;
      this.selectedCountry = null;
      this.selectedCoordinate = null;
    },

    disabledInteraction() {
      this.isAnchorMode = false;
      this.anchorable = false;
      this.zoomable = false;
    },

    enableInteraction() {
      this.anchorable = true;
      this.zoomable = true;
    },

    getLocation() {
      return {
        k: this.k,
        lon: this.lon,
        lat: this.lat,
      };
    },
    cachedMapLocation() {
      localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify({ k: this.k, lon: this.lon, lat: this.lat }));
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
        if (typeof saved?.k === "number") {
          this.k = saved.k;
        }
        if (typeof saved?.lon === "number") {
          this.lon = saved.lon;
        }
        if (typeof saved?.lat === "number") {
          this.lat = saved.lat;
        }
      } catch {
        // ignore corrupted storage
      }
    },

    resetLocation() {
      this.k = MIN_ZOOM;
      this.lon = 0;
      this.lat = 0;
      this.handleMoveToArea({});
    },

    resetSelectedCoordinate() {
      this.selectedCoordinate = null;
    },

    resetSelectedCountry() {
      this.selectedCountry = null;
    },

    setWorldSelectedCoordinate(position: { x: number; y: number }) {
      this.selectedCoordinate = position;
    },

    setCountrySelected(country: { id: string; title: string }) {
      this.selectedCountry = country;
    },

    toggleAnchorMode() {
      this.isAnchorMode = !this.isAnchorMode;
    },
  },
});
