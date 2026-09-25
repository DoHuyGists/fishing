import { defineStore } from "pinia";
import {
  supabaseDiaryRepository,
  type Species,
  type CaughtDiary,
} from "../data/supabaseDiaryRepository";

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
      const targetSpecies = state.allSpecies.length > 0 ? state.allSpecies : state.locationSpecies;
      
      const filtered = targetSpecies.filter((item) => {
        if (!item.location) return false;
        const loc = item.location.trim().toLowerCase();
        return (
          (code && (loc === code || loc.includes(code))) ||
          (name && (loc === name || loc.includes(name) || name.includes(loc)))
        );
      });

      return filtered.map((species) => ({
        species,
        isCaught: caughtMap.has(species.id),
        caughtAt: caughtMap.get(species.id),
      }));
    },
  },

  actions: {
    async loadDiary(userId?: string) {
      await this.initDiary(userId);
    },

    async initDiary(userId?: string) {
      this.isLoading = true;
      this.error = null;
      try {
        const [speciesData, caughtData] = await Promise.all([
          supabaseDiaryRepository.fetchSpecies(),
          userId ? supabaseDiaryRepository.fetchCaughtDiary(userId) : Promise.resolve([]),
        ]);

        this.allSpecies = speciesData;
        this.caughtDiary = caughtData;
      } catch (err: any) {
        this.error = err?.message || "Không thể tải dữ liệu nhật ký";
        console.error("Failed to init diary:", err);
      } finally {
        this.isLoading = false;
      }
    },

    async selectLocation(userId: string | undefined, code: string, name: string) {
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
        console.error(`Failed to load species for ${code} (${name}):`, err);
      } finally {
        this.isLoading = false;
      }
    },

    clearSelectedLocation() {
      this.selectedLocationCode = null;
      this.selectedLocationName = null;
      this.locationSpecies = [];
    }
  },
});
