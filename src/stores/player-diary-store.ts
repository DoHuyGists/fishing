import { useGameCatalogStore } from "./player-game-catalog-store";
import { useAuthStore } from "./auth";
import { useReadCacheStore } from "./readCache";
import type { Species, CaughtDiary, DiaryFishEntry } from "../types/model/diary";
import type { AreaSpecies } from "../types/model/speciesInArea";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseDiaryRepository } from "../data/supabaseDiaryRepository";
import { supabaseSpeciesInAreaRepository } from "../data/supabaseSpeciesInAreaRepository";
import { supabaseSpeciesRepository } from "../data/supabaseSpeciesRepository";
import type { SpeciesRow } from "../types/table/species";

export type { DiaryFishEntry } from "../types/model/diary";

export const useDiaryStore = defineStore("diary", {
  state: () => ({
    viewMode: "grid",
    speciesSearch: "",
    speciesDetails: {} as Record<string, SpeciesRow>,
    detailsLoading: {} as Record<string, boolean>,
    detailsErrors: {} as Record<string, string>,
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
    diaryRequestId: 0,
  }),

  getters: {
    filteredEntriesForCountry() {
      const normalize = (value: string) =>
        value
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .trim();
      const query = normalize(this.speciesSearch);
      return (code: string, name: string): DiaryFishEntry[] => {
        const entries = this.entriesForCountry(code, name);
        return query ? entries.filter(({ species }) => normalize(species.name).includes(query)) : entries;
      };
    },

    caughtEntriesForCountry() {
      return (code: string, name: string): DiaryFishEntry[] =>
        this.entriesForCountry(code, name).filter((entry) => entry.isCaught);
    },

    entriesForCountry(state) {
      const caughtMap = this.caughtSpeciesMap;
      const entries = state.allSpecies.map(
        (species): DiaryFishEntry => ({
          species,
          isCaught: caughtMap.has(species.id),
          caughtAt: caughtMap.get(species.id),
        }),
      );
      return (code: string, name: string): DiaryFishEntry[] => {
        const countryCode = code.trim().toLowerCase();
        const countryName = name.trim().toLowerCase();
        return entries.filter(({ species }) => {
          const location = species.location?.trim().toLowerCase();
          return Boolean(
            location &&
            ((countryCode && location.includes(countryCode)) ||
              (countryName && (location.includes(countryName) || countryName.includes(location)))),
          );
        });
      };
    },

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
    async loadSpeciesDetails(id: string) {
      if (this.speciesDetails[id] || this.detailsLoading[id]) return;
      const auth = useAuthStore(),
        generation = auth.sessionGeneration;
      this.detailsLoading[id] = true;
      delete this.detailsErrors[id];
      try {
        const details = await supabaseSpeciesRepository.fetchById(id);
        if (auth.sessionGeneration === generation) this.speciesDetails[id] = details;
      } catch (error) {
        if (auth.sessionGeneration === generation)
          this.detailsErrors[id] = error instanceof Error ? error.message : tr("diary.khong_the_tai_du_lieu_nhat_ky");
      } finally {
        if (auth.sessionGeneration === generation) this.detailsLoading[id] = false;
      }
    },

    applySpecies(data?: Species[]) {
      this.allSpecies = data ?? [];
      if (!data) {
        this.speciesDetails = {};
        this.detailsErrors = {};
        this.detailsLoading = {};
        this.caughtDiary = [];
        this.locationSpecies = [];
        this.discoveredAreaSpecies = [];
        this.areaSpeciesRequestId++;
        this.isLoading = false;
      } else if (this.selectedLocationCode) {
        const matches = [this.selectedLocationCode, this.selectedLocationName]
          .filter((value): value is string => Boolean(value))
          .map((value) => value.toLocaleLowerCase());
        this.locationSpecies = data.filter((species) =>
          matches.some((value) => species.location?.toLocaleLowerCase().includes(value)),
        );
      }
    },
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
        this.areaSpeciesError =
          err instanceof Error ? err.message : tr("PrepareModal.khong_the_tai_danh_sach_ca_trong_ho");
      } finally {
        if (requestId === this.areaSpeciesRequestId) this.isLoadingAreaSpecies = false;
      }
    },

    async initDiary(userId?: string, force = false) {
      const auth = useAuthStore(),
        generation = auth.sessionGeneration,
        request = ++this.diaryRequestId;
      const current = () => auth.sessionGeneration === generation && request === this.diaryRequestId;
      this.isLoading = true;
      this.error = null;
      try {
        if (force) await useReadCacheStore().invalidate(["diaryOwned"]);
        if (!current()) return;
        const [, caughtData] = await Promise.all([
          useGameCatalogStore().get("species", {
            force,
            consumer: "diary",
            onUpdate: (data) => this.applySpecies(data),
          }),
          userId ? supabaseDiaryRepository.fetchCaughtDiary(userId) : Promise.resolve([]),
        ]);
        if (!current()) return;
        this.caughtDiary = caughtData;
      } catch (err: any) {
        if (current()) this.error = err?.message || tr("diary.khong_the_tai_du_lieu_nhat_ky");
      } finally {
        if (current()) this.isLoading = false;
      }
    },

    async selectLocation(userId: string | undefined, code: string, name: string) {
      const auth = useAuthStore(),
        generation = auth.sessionGeneration,
        request = ++this.diaryRequestId;
      const current = () => auth.sessionGeneration === generation && request === this.diaryRequestId;
      this.error = null;
      this.locationSpecies = [];
      this.selectedLocationCode = code;
      this.selectedLocationName = name;
      this.isLoading = true;

      try {
        // Fetch caught list if not loaded yet
        if (userId && this.caughtDiary.length === 0) {
          const caught = await supabaseDiaryRepository.fetchCaughtDiary(userId);
          if (!current()) return;
          this.caughtDiary = caught;
        }

        // Fetch location species
        const all = await useGameCatalogStore().get("species", {
          consumer: "diary",
          onUpdate: (data) => this.applySpecies(data),
        });
        if (!current()) return;
        const matches = [code, name].filter(Boolean).map((value) => value.toLocaleLowerCase());
        const speciesData = all.filter((species) =>
          matches.some((value) => species.location?.toLocaleLowerCase().includes(value)),
        );
        this.locationSpecies = speciesData;
      } catch (err: any) {
        if (current()) this.error = err?.message || tr("diary.khong_the_tai_danh_sach_ca_vui_long_thu_lai");
      } finally {
        if (current()) this.isLoading = false;
      }
    },

    clearSelectedLocation() {
      this.selectedLocationCode = null;
      this.selectedLocationName = null;
      this.locationSpecies = [];
    },
  },
});
