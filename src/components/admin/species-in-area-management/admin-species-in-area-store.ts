import type { FishingAreaRow } from "../../../types/table/fishingArea";
import type { SpeciesInAreaPayload, SpeciesInAreaRow } from "../../../types/table/speciesInArea";
import type { SpeciesRow } from "../../../types/table/species";
import { defineStore } from "pinia";
import { supabaseFishingAreaRepository } from "../../../data/supabaseFishingAreaRepository";
import { supabaseSpeciesInAreaRepository } from "../../../data/supabaseSpeciesInAreaRepository";
import { supabaseSpeciesRepository } from "../../../data/supabaseSpeciesRepository";

export const useSpeciesInAreaStore = defineStore("speciesInArea", {
  state: () => ({
    rows: [] as SpeciesInAreaRow[],
    page: 1, pageSize: 10, total: 0, search: '', areaFilter: 'ALL', speciesFilter: 'ALL', requestId: 0,
    areaFilterIds: [] as string[], speciesFilterIds: [] as string[],
    areas: [] as FishingAreaRow[],
    species: [] as SpeciesRow[],
    loading: false,
    saving: false,
    deletingKey: null as string | null,
    error: "",
  }),
  actions: {
    async fetchAll(page?: number) {
      page ??= this.page;
      const request = ++this.requestId;
      this.loading = true;
      this.error = "";
      try {
        const [rows, areas, species] = await Promise.all([
          supabaseSpeciesInAreaRepository.fetchPage(page, this.search, this.areaFilter, this.speciesFilter),
          supabaseFishingAreaRepository.fetchAllAreasAdmin(),
          supabaseSpeciesRepository.fetchAll(),
        ]);
        if (request !== this.requestId) return;
        this.rows = rows.items; this.total = rows.total; this.page = page;
        this.areaFilterIds = rows.facets.area_id ?? []; this.speciesFilterIds = rows.facets.species_id ?? [];
        this.areas = areas;
        this.species = species;
        if (!rows.items.length && page > 1) await this.fetchAll(Math.max(1, Math.ceil(rows.total / this.pageSize)));
      } catch (error) {
        if (request === this.requestId) { this.error = error instanceof Error ? error.message : "Không thể tải dữ liệu"; throw error; }
      } finally {
        if (request === this.requestId) this.loading = false;
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
        await this.fetchAll();
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể xoá dữ liệu";
        throw error;
      } finally {
        this.deletingKey = null;
      }
    },
  },
});
