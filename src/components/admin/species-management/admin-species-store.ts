import type { SpeciesPayload, SpeciesRow } from "../../../types/table/species";
import { defineStore } from "pinia";
import { supabaseSpeciesRepository } from "../../../data/supabaseSpeciesRepository";

function sortSpecies(species: SpeciesRow[]) {
  return species.sort((left, right) => left.name.localeCompare(right.name));
}

export const useAdminSpeciesStore = defineStore("AdminSpecies", {
  state: () => ({
    species: [] as SpeciesRow[],
    isLoading: false,
    error: "",
    search: "",
    statusFilter: "ALL",
    rarityFilter: "ALL",
    viewMode: "list" as "list" | "grid" | "grouped",
  }),
  getters: {
    statusOptions: (state) =>
      [...new Set(state.species.map((item) => item.status).filter((value): value is string => Boolean(value)))].sort(),
    rarityOptions: (state) =>
      [...new Set(state.species.map((item) => item.rarity).filter((value): value is string => Boolean(value)))].sort(),
    filteredSpecies: (state): SpeciesRow[] => {
      const keyword = state.search.trim().toLocaleLowerCase();
      return state.species.filter((item) => {
        const matchesSearch =
          !keyword ||
          [item.name, item.location, item.status, item.rarity, item.information, item.image].some((value) =>
            value?.toLocaleLowerCase().includes(keyword),
          );
        return matchesSearch &&
          (state.statusFilter === "ALL" || item.status === state.statusFilter) &&
          (state.rarityFilter === "ALL" || item.rarity === state.rarityFilter);
      });
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
    async fetchAll() {
      this.isLoading = true;
      this.error = "";
      try {
        this.species = await supabaseSpeciesRepository.fetchAll();
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể tải danh sách loài cá";
      } finally {
        this.isLoading = false;
      }
    },

    async createSpecies(payload: SpeciesPayload) {
      this.error = "";
      try {
        const created = await supabaseSpeciesRepository.create(payload);
        this.species = sortSpecies([...this.species, created]);
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
        this.species = sortSpecies(this.species.map((item) => (item.id === id ? updated : item)));
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
        this.species = this.species.filter((item) => item.id !== id);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể xoá loài cá";
        throw error;
      }
    },
  },
});
