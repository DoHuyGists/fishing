import { defineStore } from "pinia";
import { supabaseFishingAreaRepository } from "../data/supabaseFishingAreaRepository";

const fishingAreaRepository = supabaseFishingAreaRepository;

export const useFishingAreaStore = defineStore("fishing_areas", {
  state: () => ({
    areas: [] as any[],
    loading: false,
    loaded: false,
    error: "",
  }),
  actions: {
    async fetchArea() {
      if (this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        this.areas = await fishingAreaRepository.fetchAreas();
        this.loaded = true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể tải trang bị từ máy chủ";
      } finally {
        this.loading = false;
      }
    },
    reset() {
      this.areas = [];
      this.loaded = false;
      this.error = "";
    },
  },
});
