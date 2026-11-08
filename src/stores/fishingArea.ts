import { defineStore } from "pinia";
import { supabaseFishingAreaRepository, type FishingAreaRow } from "../data/supabaseFishingAreaRepository";
import { useCountryStore } from "./country";

export type FishingArea = Pick<FishingAreaRow, "id" | "countryId" | "title" | "location" | "scenePath">;

export const useFishingAreaStore = defineStore("fishing_areas", {
  state: () => ({
    fishingAreas: [] as FishingArea[],
    loading: false,
    loaded: false,
    error: "",
  }),
  getters: {
    areasByCountry(state) {
      const countries = new Map(useCountryStore().countries.map((country) => [country.id, country.name]));
      const groups = new Map<string, { id: string; name: string; areas: FishingArea[] }>();

      for (const area of state.fishingAreas) {
        const countryId = countries.has(area.countryId) ? area.countryId : "";
        let group = groups.get(countryId);
        if (!group) {
          group = { id: countryId, name: countries.get(countryId) ?? "Chưa xác định quốc gia", areas: [] };
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
    async fetchArea() {
      if (this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        this.fishingAreas = await supabaseFishingAreaRepository.fetchAreas();
        this.loaded = true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể tải trang bị từ máy chủ";
      } finally {
        this.loading = false;
      }
    },

    reset() {
      this.fishingAreas = [];
      this.loaded = false;
      this.error = "";
    },
  },
});
