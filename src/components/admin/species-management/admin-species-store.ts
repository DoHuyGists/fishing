import type { SpeciesPayload, SpeciesRow } from "../../../types/table/species";
import { defineStore } from "pinia";
import { supabaseSpeciesRepository } from "../../../data/supabaseSpeciesRepository";

export const useAdminSpeciesStore = defineStore("AdminSpecies", {
  state: () => ({
    species: [] as SpeciesRow[],
    isLoading: false,
    error: "",
    search: "",
    statusFilter: "ALL",
    rarityFilter: "ALL",
    viewMode: "list" as "list" | "grid" | "grouped",
    page: 1,
    pageSize: 10,
    total: 0,
    requestId: 0,
    statuses: [] as string[],
    rarities: [] as string[],
  }),
  getters: {
    statusOptions: (state) => state.statuses,
    rarityOptions: (state) => state.rarities,
    filteredSpecies: (state): SpeciesRow[] => {
      return state.species;
    },
    speciesGroups(): { location: string; species: SpeciesRow[] }[] {
      if (this.viewMode !== "grouped") return [{ location: "", species: this.filteredSpecies }];

      const groups = new Map<string, SpeciesRow[]>();
      for (const item of this.filteredSpecies) {
        const location = item.location?.trim() || "";
        const group = groups.get(location);
        if (group) group.push(item);
        else groups.set(location, [item]);
      }
      return [...groups.entries()]
        .sort(([left], [right]) => {
          if (!left) return 1;
          if (!right) return -1;
          return left.localeCompare(right, "vi");
        })
        .map(([location, species]) => ({ location, species }));
    },
  },
  actions: {
    async fetchAll(page?: number) {
      page ??= this.page;
      const request = ++this.requestId;
      this.isLoading = true;
      this.error = "";
      try {
        const result = await supabaseSpeciesRepository.fetchPage(page, this.search, this.statusFilter, this.rarityFilter);
        if (request !== this.requestId) return;
        this.species = result.items; this.total = result.total; this.page = page;
        this.statuses = result.facets.status ?? []; this.rarities = result.facets.rarity ?? [];
        if (!result.items.length && page > 1) await this.fetchAll(Math.max(1, Math.ceil(result.total / this.pageSize)));
      } catch (error) {
        if (request === this.requestId) this.error = error instanceof Error ? error.message : "Không thể tải danh sách loài cá";
      } finally {
        if (request === this.requestId) this.isLoading = false;
      }
    },

    async createSpecies(payload: SpeciesPayload) {
      this.error = "";
      try {
        const created = await supabaseSpeciesRepository.create(payload);
        await this.fetchAll(1);
        return created;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể tạo loài cá";
        throw error;
      }
    },

    async updateSpecies(id: string, payload: SpeciesPayload) {
      this.error = "";
      try {
        const updated = await supabaseSpeciesRepository.update(id, payload);
        await this.fetchAll();
        return updated;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể cập nhật loài cá";
        throw error;
      }
    },

    async deleteSpecies(id: string) {
      this.error = "";
      try {
        await supabaseSpeciesRepository.delete(id);
        await this.fetchAll();
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể xoá loài cá";
        throw error;
      }
    },
  },
});
