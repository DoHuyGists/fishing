import { defineStore } from "pinia";
import {
  supabaseSpeciesRepository,
  type SpeciesPayload,
  type SpeciesRow,
} from "../../../data/supabaseSpeciesRepository";

function sortSpecies(species: SpeciesRow[]) {
  return species.sort((left, right) => left.name.localeCompare(right.name));
}

export const useAdminSpeciesStore = defineStore("AdminSpecies", {
  state: () => ({
    species: [] as SpeciesRow[],
    isLoading: false,
    error: "",
  }),
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
