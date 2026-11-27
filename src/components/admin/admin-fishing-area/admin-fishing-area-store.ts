import type { FishingAreaPayload, FishingAreaRow } from "../../../types/table/fishingArea";
import { defineStore } from "pinia";
import { toRaw } from "vue";
import { supabaseFishingAreaRepository } from "../../../data/supabaseFishingAreaRepository";

export const useAdminFishingAreaStore = defineStore("AdminFishingArea", {
  state: () => ({
    target: null as FishingAreaRow | null,
    adminAreas: [] as FishingAreaRow[],
    viewMode: 'list' as 'list' | 'grid' | 'group',
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
      const grouped = this.viewMode === 'group';
      if (grouped) page = 1;
      const request = ++this.requestId;
      this.adminLoading = true;
      this.adminError = "";
      try {
        const result = await supabaseFishingAreaRepository.fetchAdminPage(page, this.search, this.countryFilter, this.availabilityFilter);
        if (request !== this.requestId) return;
        if (grouped) {
          const items = [...result.items];
          const search = this.search, country = this.countryFilter, availability = this.availabilityFilter;
          for (let nextPage = 2; nextPage <= Math.ceil(result.total / this.pageSize); nextPage++) {
            const next = await supabaseFishingAreaRepository.fetchAdminPage(nextPage, search, country, availability);
            if (request !== this.requestId) return;
            items.push(...next.items);
          }
          result.items = items;
        }
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
        allowDepthTool: false,
        survivalMode: false,
        timezone: null,
        createdAt: "",
      };
    },

    openForm(fishingAreaData?: FishingAreaRow) {
      this.isFormOpen = true;
      this.isCreate = !fishingAreaData;
      this.isUpdate = Boolean(fishingAreaData);
      if (fishingAreaData) {
        this.target = structuredClone(toRaw(fishingAreaData));
        this.isFormLock = true;
      } else {
        this.target = this.emptyForm();
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
