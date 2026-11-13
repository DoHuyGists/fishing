import type { FishingAreaPayload, FishingAreaRow } from "../../../types/table/fishingArea";
import { defineStore } from "pinia";
import { supabaseFishingAreaRepository } from "../../../data/supabaseFishingAreaRepository";

export const useAdminFishingAreaStore = defineStore("AdminFishingArea", {
  state: () => ({
    target: null as FishingAreaRow | null,
    adminAreas: [] as FishingAreaRow[],
    page: 1, pageSize: 10, total: 0, search: '', countryFilter: 'ALL', availabilityFilter: 'ALL', requestId: 0,
    countryIds: [] as string[],

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
    async fetchAllAreasAdmin(page?: number) {
      page ??= this.page;
      const request = ++this.requestId;
      this.adminLoading = true;
      this.adminError = "";
      try {
        const result = await supabaseFishingAreaRepository.fetchAdminPage(page, this.search, this.countryFilter, this.availabilityFilter);
        if (request !== this.requestId) return;
        this.adminAreas = result.items; this.page = page; this.total = result.total; this.countryIds = result.facets.country_id ?? [];
        if (!result.items.length && page > 1) await this.fetchAllAreasAdmin(Math.max(1, Math.ceil(result.total / this.pageSize)));
      } catch (err) {
        if (request === this.requestId) this.adminError = err instanceof Error ? err.message : "Không thể tải danh sách bãi câu";
      } finally {
        if (request === this.requestId) this.adminLoading = false;
      }
    },

    async createAreaAdmin(payload: FishingAreaPayload) {
      const created = await supabaseFishingAreaRepository.createArea(payload);
      await this.fetchAllAreasAdmin();
      return created;
    },

    async updateAreaAdmin(id: string, payload: FishingAreaPayload) {
      const updated = await supabaseFishingAreaRepository.updateArea(id, payload);
      await this.fetchAllAreasAdmin();
      return updated;
    },

    async deleteAreaAdmin(id: string) {
      await supabaseFishingAreaRepository.deleteArea(id);
      await this.fetchAllAreasAdmin();
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
        countryId: "",
        isAvailable: false,
        title: "",
        scenePath: "",
        location: "",
        fishingBoundary: [],
        zoneId: null,
        maxDepth: null,
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
