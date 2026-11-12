import type { Species, CaughtDiary } from "../types/model/diary";
import type { AreaSpecies } from "../types/model/speciesInArea";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseDiaryRepository } from "../data/supabaseDiaryRepository";
import { supabaseSpeciesInAreaRepository } from "../data/supabaseSpeciesInAreaRepository";

export interface DiaryFishEntry {
  species: Species;
  isCaught: boolean;
  caughtAt?: string;
}

export const useDiaryStore = defineStore("diary", {
  state: () => ({
    allSpecies: [] as Species[],
    caughtDiary: [] as CaughtDiary[],
    locationSpecies: [] as Species[],
    selectedLocationCode: null as string | null,
    selectedLocationName: null as string | null,
    isLoading: false,
    error: null as string | null,
    discoveredAreaSpecies: [] as AreaSpecies[],
    isLoadingAreaSpecies: false,
    areaSpeciesError: "",
    areaSpeciesRequestId: 0,
  }),

  getters: {
    caughtSpeciesMap(state): Map<string, string> {
      const map = new Map<string, string>();
      for (const entry of state.caughtDiary) {
        if (entry.species_id) {
          map.set(entry.species_id, entry.created_at);
        }
      }
      return map;
    },

    // Map species count per location key or location name
    speciesCountByLocation(state): Record<string, number> {
      const counts: Record<string, number> = {};
      for (const item of state.allSpecies) {
        if (item.location) {
          const loc = item.location.trim().toUpperCase();
          counts[loc] = (counts[loc] || 0) + 1;
        }
      }
      return counts;
    },

    currentLocationEntries(state): DiaryFishEntry[] {
      const caughtMap = this.caughtSpeciesMap;
      const code = state.selectedLocationCode?.trim().toLowerCase();
      const name = state.selectedLocationName?.trim().toLowerCase();

      // Filter from allSpecies or locationSpecies
      const targetSpecies = state.selectedLocationCode ? state.locationSpecies : state.allSpecies;

      const filtered = targetSpecies.filter((item) => {
        if (!item.location) return false;
        const loc = item.location.trim().toLowerCase();
        return (code && (loc === code || loc.includes(code))) || (name && (loc === name || loc.includes(name) || name.includes(loc)));
      });

      return filtered.map((species) => ({
        species,
        isCaught: caughtMap.has(species.id),
        caughtAt: caughtMap.get(species.id),
      }));
    },
  },

  actions: {
    async loadDiscoveredAreaSpecies(areaId: string | null | undefined, userId: string | null | undefined) {
      const requestId = ++this.areaSpeciesRequestId;
      this.discoveredAreaSpecies = [];
      this.areaSpeciesError = "";
      this.isLoadingAreaSpecies = false;
      if (!areaId || !userId) return;

      this.isLoadingAreaSpecies = true;
      try {
        const [species, caught] = await Promise.all([
          supabaseSpeciesInAreaRepository.fetchSpeciesByAreaId(areaId),
          supabaseDiaryRepository.fetchCaughtDiary(userId),
        ]);
        if (requestId !== this.areaSpeciesRequestId) return;

        const caughtIds = new Set(caught.map((entry) => entry.species_id));
        const discovered = species.filter((fish) => caughtIds.has(fish.id));
        this.discoveredAreaSpecies = [...new Map(discovered.map((fish) => [fish.id, fish])).values()];
      } catch (err) {
        if (requestId !== this.areaSpeciesRequestId) return;
        this.areaSpeciesError = err instanceof Error ? err.message : tr('PrepareModal.khong_the_tai_danh_sach_ca_trong_ho');
      } finally {
        if (requestId === this.areaSpeciesRequestId) this.isLoadingAreaSpecies = false;
      }
    },

    async initDiary(userId?: string) {
      this.isLoading = true;
      this.error = null;
      try {
        const [speciesData, caughtData] = await Promise.all([supabaseDiaryRepository.fetchSpecies(), userId ? supabaseDiaryRepository.fetchCaughtDiary(userId) : Promise.resolve([])]);

        this.allSpecies = speciesData;
        this.caughtDiary = caughtData;
      } catch (err: any) {
        this.error = err?.message || tr('diary.khong_the_tai_du_lieu_nhat_ky');
        console.error("Failed to init diary:", err);
      } finally {
        this.isLoading = false;
      }
    },

    async selectLocation(userId: string | undefined, code: string, name: string) {
      this.error = null;
      this.locationSpecies = [];
      this.selectedLocationCode = code;
      this.selectedLocationName = name;
      this.isLoading = true;

      try {
        // Fetch caught list if not loaded yet
        if (userId && this.caughtDiary.length === 0) {
          this.caughtDiary = await supabaseDiaryRepository.fetchCaughtDiary(userId);
        }

        // Fetch location species
        const speciesData = await supabaseDiaryRepository.fetchSpeciesByLocation(code, name);
        this.locationSpecies = speciesData;
      } catch (err: any) {
        this.error = err?.message || tr('diary.khong_the_tai_danh_sach_ca_vui_long_thu_lai');
      } finally {
        this.isLoading = false;
      }
    },

    clearSelectedLocation() {
      this.selectedLocationCode = null;
      this.selectedLocationName = null;
      this.locationSpecies = [];
    },
  },
});
