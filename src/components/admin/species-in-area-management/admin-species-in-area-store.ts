import { defineStore } from "pinia";
import { supabaseFishingAreaRepository, type FishingAreaRow } from "../../../data/supabaseFishingAreaRepository";
import { supabaseSpeciesInAreaRepository, type SpeciesInAreaPayload, type SpeciesInAreaRow } from "../../../data/supabaseSpeciesInAreaRepository";
import { supabaseSpeciesRepository, type SpeciesRow } from "../../../data/supabaseSpeciesRepository";

export const useSpeciesInAreaStore = defineStore("speciesInArea", {
  state: () => ({
    rows: [] as SpeciesInAreaRow[],
    areas: [] as FishingAreaRow[],
    species: [] as SpeciesRow[],
    loading: false,
    saving: false,
    deletingKey: null as string | null,
    error: "",
  }),
  actions: {
    async fetchAll() {
      this.loading = true;
      this.error = "";
      try {
        const [rows, areas, species] = await Promise.all([
          supabaseSpeciesInAreaRepository.fetchAll(),
          supabaseFishingAreaRepository.fetchAllAreasAdmin(),
          supabaseSpeciesRepository.fetchAll(),
        ]);
        this.rows = rows;
        this.areas = areas;
        this.species = species;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể tải dữ liệu";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async save(payload: SpeciesInAreaPayload, originalAreaId: string | null, originalSpeciesId: string | null) {
      this.saving = true;
      this.error = "";
      try {
        if (originalAreaId && originalSpeciesId) {
          await supabaseSpeciesInAreaRepository.update(originalAreaId, originalSpeciesId, payload);
        } else {
          await supabaseSpeciesInAreaRepository.create(payload);
        }
        await this.fetchAll();
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể lưu dữ liệu";
        throw error;
      } finally {
        this.saving = false;
      }
    },
    async remove(areaId: string, speciesId: string) {
      const key = `${areaId}:${speciesId}`;
      this.deletingKey = key;
      this.error = "";
      try {
        await supabaseSpeciesInAreaRepository.delete(areaId, speciesId);
        this.rows = this.rows.filter((row) => `${row.areaId}:${row.speciesId}` !== key);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể xoá dữ liệu";
        throw error;
      } finally {
        this.deletingKey = null;
      }
    },
  },
});
