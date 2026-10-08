import { defineStore } from "pinia";
import {
  supabaseFishingAreaRepository,
  type FishingAreaPayload,
  type FishingAreaRow,
} from "../../../data/supabaseFishingAreaRepository";

export const useAdminFishingAreaStore = defineStore("AdminFishingArea", {
  state: () => ({
    target: null as FishingAreaRow | null,
    adminAreas: [] as FishingAreaRow[],

    adminLoading: false,
    adminError: "",

    isFormOpen: false,
    isCreate: false,
    isUpdate: false,
    isFormLock: true,
  }),
  getters: {
    // for computed
  },
  actions: {
    async fetchAllAreasAdmin() {
      this.adminLoading = true;
      this.adminError = "";
      try {
        this.adminAreas = await supabaseFishingAreaRepository.fetchAllAreasAdmin();
      } catch (err) {
        this.adminError = err instanceof Error ? err.message : "Không thể tải danh sách bãi câu";
      } finally {
        this.adminLoading = false;
      }
    },

    async createAreaAdmin(payload: FishingAreaPayload) {
      const created = await supabaseFishingAreaRepository.createArea(payload);
      this.adminAreas.unshift(created);
      return created;
    },

    async updateAreaAdmin(id: string, payload: FishingAreaPayload) {
      const updated = await supabaseFishingAreaRepository.updateArea(id, payload);
      const index = this.adminAreas.findIndex((area) => area.id === id);
      if (index !== -1) this.adminAreas[index] = updated;
      return updated;
    },

    async deleteAreaAdmin(id: string) {
      await supabaseFishingAreaRepository.deleteArea(id);
      this.adminAreas = this.adminAreas.filter((area) => area.id !== id);
    },

    resetDefault() {
      this.target = null;
      this.adminLoading = false;
      this.adminError = "";
      this.isFormOpen = false;
      this.isCreate = false;
      this.isUpdate = false;
      this.isFormLock = true;
    },

    emptyForm(): FishingAreaRow {
      return {
        id: "",
        countryId: "UNKNOWN",
        isAvailable: false,
        x: 0,
        y: 0,
        title: "",
        scenePath: "",
        location: "",
        fishingBoundary: [],
        createdAt: "",
      };
    },

    openForm(fishingAreaData?: FishingAreaRow) {
      this.isFormOpen = true;
      if (fishingAreaData) {
        this.target = fishingAreaData;
        this.isUpdate = true;
        this.isFormLock = true;
      } else {
        this.target = this.emptyForm();
        this.isCreate = true;
        this.isFormLock = false;
      }
      this.adminError = "";
    },
    closeForm() {
      this.isFormOpen = false;
      this.adminError = "";
      this.target = null;
    },
  },
});
