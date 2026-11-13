import { useGameCatalogStore } from './gameCatalog';
import { useAuthStore } from './auth';
import type { FishingAreaRow } from "../types/table/fishingArea";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { useCountryStore } from "./country";
import { useWorldStore } from "./worldMap";

export type FishingArea = Pick<FishingAreaRow, "id" | "countryId" | "title" | "location" | "scenePath">;

interface FishingAreaCountryGroup {
  id: string;
  name: string;
  areas: FishingArea[];
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

export const useFishingAreaStore = defineStore("fishing_areas", {
  state: () => ({
    fishingAreas: [] as FishingArea[],
    loading: false,
    loaded: false,
    error: "",
    searchQuery: "",
  }),
  getters: {
    normalizedSearchQuery: (state): string => normalizeSearch(state.searchQuery.trim()),

    filteredAreasByCountry(): FishingAreaCountryGroup[] {
      const query = this.normalizedSearchQuery;
      if (!query) return this.areasByCountry;
      return this.areasByCountry
        .map((group) => ({
          ...group,
          areas: normalizeSearch(group.name).includes(query)
            ? group.areas
            : group.areas.filter((area) => normalizeSearch(area.title || tr('FishingAnchor.bai_cau_chua_dat_ten')).includes(query)),
        }))
        .filter((group) => group.areas.length > 0);
    },

    visibleMapAreas(state): FishingArea[] {
      const countryId = useWorldStore().visibleAreaCountryId;
      if (!countryId) return [];
      return state.fishingAreas.filter((area) => area.countryId === countryId);
    },

    areasByCountry(state): FishingAreaCountryGroup[] {
      const countries = new Map(useCountryStore().countries.map((country) => [country.id, country.name]));
      const groups = new Map<string, FishingAreaCountryGroup>();

      for (const area of state.fishingAreas) {
        const countryId = countries.has(area.countryId) ? area.countryId : "";
        let group = groups.get(countryId);
        if (!group) {
          group = { id: countryId, name: countries.get(countryId) ?? tr('fishingArea.chua_xac_dinh_quoc_gia'), areas: [] };
          groups.set(countryId, group);
        }
        group.areas.push(area);
      }

      return [...groups.values()]
        .sort((a, b) => a.name.localeCompare(b.name, "vi"))
        .map((group) => ({
          ...group,
          areas: group.areas.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "vi")),
        }));
    },
  },
  actions: {
    async fetchArea(force = false) {
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      this.loading = true;
      this.error = "";
      try {
        await useGameCatalogStore().get('areas', { force, consumer: 'fishingArea', onUpdate: data => { this.fishingAreas = data ?? []; this.loaded = Boolean(data); if (!data) { this.loading = false; this.error = ''; } } });
      } catch (err) {
        if (auth.sessionGeneration === generation) this.error = err instanceof Error ? err.message : tr('equipment.khong_the_tai_trang_bi_tu_may_chu');
      } finally {
        if (auth.sessionGeneration === generation) this.loading = false;
      }
    },

    reset() {
      this.fishingAreas = [];
      this.searchQuery = "";
      this.loaded = false;
      this.error = "";
    },
  },
});
