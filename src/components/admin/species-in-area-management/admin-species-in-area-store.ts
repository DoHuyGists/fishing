import type { FishingAreaRow } from "../../../types/table/fishingArea";
import type { SpeciesInAreaPayload, SpeciesInAreaRow, SpeciesDistributionBoundary } from "../../../types/table/speciesInArea";
import type { SpeciesRow } from "../../../types/table/species";
import type { SpeciesDistributionState } from "../../../types/model/speciesInArea";
import { defineStore } from "pinia";
import { supabaseFishingAreaRepository } from "../../../data/supabaseFishingAreaRepository";
import { supabaseSpeciesInAreaRepository } from "../../../data/supabaseSpeciesInAreaRepository";
import { supabaseSpeciesRepository } from "../../../data/supabaseSpeciesRepository";
import { cloneBoundary, createSpeciesBoundary, storedSpeciesBoundary, validSpeciesBoundary } from '../../../utils/speciesDistributionBoundary';

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
    distributions: {} as Record<string, SpeciesDistributionState>,
  }),
  actions: {
    async loadDistribution(areaId: string, force = false) {
      const current = this.distributions[areaId];
      if (current?.loading || current?.saving || (current?.loaded && !force)) return;
      this.distributions[areaId] = { rows: [], weights: {}, boundary: createSpeciesBoundary(), originalBoundary: createSpeciesBoundary(), loading: true, loaded: false, saving: false, error: '', saved: false };
      const state = this.distributions[areaId]!;
      try {
        const rows = await supabaseSpeciesInAreaRepository.fetchDistribution(areaId);
        // A refresh may have replaced the editor while this request was pending.
        if (this.distributions[areaId] !== state) return;
        Object.assign(state, {
          rows, weights: Object.fromEntries(rows.map(row => [row.speciesId, row.weightRate])), loaded: true,
          boundary: storedSpeciesBoundary(rows), originalBoundary: storedSpeciesBoundary(rows),
        });
      } catch (error) {
        if (this.distributions[areaId] === state) {
          state.error = error instanceof Error ? error.message : 'Không thể tải phân bổ';
        }
      } finally {
        state.loading = false;
      }
    },
    setDistributionWeights(areaId: string, weights: Record<string, number | null>) {
      const state = this.distributions[areaId];
      if (!state?.loaded || state.saving) return;
      for (const row of state.rows) {
        if (Object.hasOwn(weights, row.speciesId)) state.weights[row.speciesId] = weights[row.speciesId]!;
      }
      state.saved = false;
      state.error = '';
    },
    setDistributionBoundary(areaId: string, boundary: SpeciesDistributionBoundary) {
      const state = this.distributions[areaId];
      if (!state?.loaded || state.saving || !validSpeciesBoundary(boundary)) return;
      state.boundary = cloneBoundary(boundary);
      state.saved = false;
      state.error = '';
    },
    resetDistribution(areaId: string) {
      const state = this.distributions[areaId];
      if (!state || state.saving) return;
      state.weights = Object.fromEntries(state.rows.map(row => [row.speciesId, row.weightRate]));
      state.boundary = cloneBoundary(state.originalBoundary);
      state.error = '';
      state.saved = false;
    },
    async saveDistribution(areaId: string) {
      const state = this.distributions[areaId];
      if (!state?.loaded || state.loading || state.saving || this.saving || this.deletingKey || !state.rows.length) return;
      const weights = state.rows.map(row => ({
        speciesId: row.speciesId, weightRate: state.weights[row.speciesId], previousWeightRate: row.weightRate,
        boundary: cloneBoundary(state.boundary), previousBoundary: row.boundary ?? null,
      }));
      if (!validSpeciesBoundary(state.boundary)) { state.error = 'Vòng biên không hợp lệ.'; return; }
      if (weights.some(item => item.weightRate === null || !Number.isFinite(item.weightRate) || item.weightRate! < 0)
        || !Number.isFinite(weights.reduce((sum, item) => sum + (item.weightRate ?? 0), 0))) {
        state.error = 'Tỉ trọng của mỗi loài phải là số hữu hạn không âm.';
        return;
      }
      state.saving = true;
      state.error = '';
      state.saved = false;
      try {
        await supabaseSpeciesInAreaRepository.updateDistribution(areaId, weights.map(item => ({ ...item, weightRate: item.weightRate! })));
        for (const item of weights) {
          const row = state.rows.find(row => row.speciesId === item.speciesId)!;
          row.weightRate = item.weightRate!;
          row.boundary = cloneBoundary(item.boundary);
          const visible = this.rows.find(row => row.areaId === areaId && row.speciesId === item.speciesId);
          if (visible) { visible.weightRate = item.weightRate!; visible.boundary = cloneBoundary(item.boundary); }
        }
        state.originalBoundary = cloneBoundary(state.boundary);
        state.saved = true;
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Không thể lưu phân bổ';
      } finally {
        state.saving = false;
      }
    },
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
        await Promise.all([...new Set([payload.areaId, originalAreaId].filter((id): id is string => !!id))]
          .filter(id => this.distributions[id]).map(id => this.loadDistribution(id, true)));
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
        if (this.distributions[areaId]) await this.loadDistribution(areaId, true);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể xoá dữ liệu";
        throw error;
      } finally {
        this.deletingKey = null;
      }
    },
  },
});
