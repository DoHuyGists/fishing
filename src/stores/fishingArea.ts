import { defineStore } from "pinia";
import { supabaseFishingAreaRepository, type FishingAreaPayload, type FishingAreaRow } from "../data/supabaseFishingAreaRepository";

const fishingAreaRepository = supabaseFishingAreaRepository;

export const useFishingAreaStore = defineStore("fishing_areas", {
  state: () => ({
    areas: [] as any[],
    currentArea: {} as any,
    loading: false,
    loaded: false,
    error: "",
    adminAreas: [] as FishingAreaRow[],
    adminLoading: false,
    adminError: "",
  }),
  actions: {
    async fetchAllAreasAdmin() {
      this.adminLoading = true;
      this.adminError = "";
      try {
        this.adminAreas = await fishingAreaRepository.fetchAllAreasAdmin();
      } catch (err) {
        this.adminError = err instanceof Error ? err.message : "Không thể tải danh sách bãi câu";
      } finally {
        this.adminLoading = false;
      }
    },

    async createAreaAdmin(payload: FishingAreaPayload) {
      const created = await fishingAreaRepository.createArea(payload);
      this.adminAreas.unshift(created);
      return created;
    },

    async updateAreaAdmin(id: string, payload: FishingAreaPayload) {
      const updated = await fishingAreaRepository.updateArea(id, payload);
      const index = this.adminAreas.findIndex((area) => area.id === id);
      if (index !== -1) this.adminAreas[index] = updated;
      return updated;
    },

    async deleteAreaAdmin(id: string) {
      await fishingAreaRepository.deleteArea(id);
      this.adminAreas = this.adminAreas.filter((area) => area.id !== id);
    },

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

    async fetchCurrentArea(areaId: string) {
      if (this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        this.currentArea = await fishingAreaRepository.fetchOneAreas(areaId);
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
