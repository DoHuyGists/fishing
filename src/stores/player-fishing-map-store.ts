import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { useCountryStore } from "./player-country-store";
import type { Country } from "./player-country-store";
import type { FishingMapArea, FishingMapAreaDetails, FishingMapSpecies } from "../types/model/fishingMap";
import { supabaseFishingAreaRepository } from "../data/supabaseFishingAreaRepository";
import { supabaseSpeciesInAreaRepository } from "../data/supabaseSpeciesInAreaRepository";
import { getFormattingLocale, t as tr } from "../i18n";
import { supabaseCountryRepository } from "../data/supabaseCountryRepository";
import { useCurrencyStore } from "./player-currency-store";

export const COUNTRY_UNLOCK_COST = 300;

const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();

export const useFishingMapStore = defineStore("fishingMap", {
  state: () => ({
    countrySearch: "",
    countryFilter: "all",
    selectedCountryId: "",
    search: "",
    speciesId: "",
    sort: "name",
    viewMode: "grid" as "list" | "grid",
    species: [] as FishingMapSpecies[],
    mapAreas: [] as FishingMapAreaDetails[],
    selectedSpecies: null as FishingMapSpecies | null,
    loading: false,
    loadingSpecies: false,
    error: "",
    speciesError: "",
    request: 0,
    page: 1,
    countryIdsWithAreas: [] as string[],
    unlockingCountryId: "",
    unlockError: "",
  }),
  getters: {
    unlockedIds(): Set<string> {
      const countries = useCountryStore();
      return new Set(
        countries.unlockedPlayerId === useAuthStore().user?.id && !countries.unlockedError
          ? countries.unlockedCountries.map((country) => country.id)
          : [],
      );
    },
    countries(): Country[] {
      const query = normalize(this.countrySearch);
      return useCountryStore()
        .countries.filter(
          (country) =>
            normalize(`${country.name} ${country.code}`).includes(query) &&
            (this.countryFilter === "all" || this.unlockedIds.has(country.id) === (this.countryFilter === "unlocked")),
        )
        .sort((a, b) => Number(this.unlockedIds.has(b.id)) - Number(this.unlockedIds.has(a.id)));
    },
    selectedCountry(): Country | undefined {
      return useCountryStore().countries.find((country) => country.id === this.selectedCountryId);
    },
    canView(): boolean {
      return Boolean(this.selectedCountry && this.unlockedIds.has(this.selectedCountryId));
    },
    speciesOptions(): { id: string; name: string }[] {
      if (!this.canView) return [];
      return [
        ...new Map(
          this.species.map((row) => [row.speciesId, { id: row.speciesId, name: row.speciesName ?? "" }]),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name, getFormattingLocale()));
    },
    areas(): FishingMapArea[] {
      if (!this.canView) return [];
      const byArea = new Map<string, FishingMapSpecies[]>();
      for (const row of this.species) {
        const rows = byArea.get(row.areaId) ?? [];
        if (!rows.some((item) => item.speciesId === row.speciesId)) rows.push(row);
        byArea.set(row.areaId, rows);
      }
      const query = normalize(this.search);
      return this.mapAreas
        .filter((area) => area.countryId === this.selectedCountryId)
        .map((area) => ({ ...area, species: byArea.get(area.id) ?? [] }))
        .filter(
          (area) =>
            (!this.speciesId || area.species.some((row) => row.speciesId === this.speciesId)) &&
            (!query ||
              normalize(area.title ?? "").includes(query) ||
              area.species.some((row) => normalize(row.speciesName ?? "").includes(query))),
        )
        .sort(
          (a, b) =>
            (this.sort === "species" ? b.species.length - a.species.length : 0) ||
            (a.title ?? "").localeCompare(b.title ?? "", getFormattingLocale()),
        );
    },
    totalPages(): number {
      return Math.max(1, Math.ceil(this.areas.length / 12));
    },
    pagedAreas(): FishingMapArea[] {
      return this.areas.slice((this.page - 1) * 12, this.page * 12);
    },
  },
  actions: {
    canUnlock(countryId: string): boolean {
      return Boolean(useAuthStore().user && !this.loading && !this.error &&
        !useCountryStore().isLoadingUnlocked && !useCountryStore().unlockedError &&
        !this.unlockedIds.has(countryId) && this.countryIdsWithAreas.includes(countryId));
    },
    async unlockCountry(countryId: string): Promise<boolean> {
      if (this.unlockingCountryId || !this.canUnlock(countryId)) return false;
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      this.unlockingCountryId = countryId;
      this.unlockError = "";
      const current = () => auth.sessionGeneration === generation;
      try {
        await supabaseCountryRepository.purchaseUnlock(countryId);
        if (!current()) return false;
        await Promise.all([
          useCountryStore().fetchMyUnlockedCountries(auth.user?.id ?? null, true),
          useCurrencyStore().fetchCurrency(true),
        ]);
        if (!current()) return false;
        this.selectCountry(countryId);
        return true;
      } catch {
        if (current()) this.unlockError = tr("FishingMapModal.unlockError");
        return false;
      } finally {
        if (current()) this.unlockingCountryId = "";
      }
    },
    selectCountry(id: string) {
      if (!this.unlockedIds.has(id)) return;
      this.selectedCountryId = id;
      this.search = "";
      this.speciesId = "";
      this.page = 1;
    },
    async load(force = false) {
      const auth = useAuthStore(),
        generation = auth.sessionGeneration;
      this.loading = true;
      this.error = "";
      this.countryIdsWithAreas = [];
      const countries = useCountryStore();
      try {
        const [, , countryIds] = await Promise.all([
          countries.fetchCountries(force),
          countries.fetchMyUnlockedCountries(auth.user?.id ?? null, force),
          supabaseCountryRepository.fetchCountryIdsWithAreas(),
        ]);
        if (auth.sessionGeneration === generation) this.countryIdsWithAreas = countryIds;
      } catch {
        if (auth.sessionGeneration === generation) this.error = tr("FishingMapModal.loadError");
      }
      if (auth.sessionGeneration !== generation) return;
      this.loading = false;
      if (!countries.loaded || countries.unlockedError) this.error = tr("FishingMapModal.loadError");
      if (!this.canView)
        this.selectedCountryId = countries.countries.find((country) => this.unlockedIds.has(country.id))?.id ?? "";
    },
    async loadSpecies() {
      const request = ++this.request,
        auth = useAuthStore(),
        generation = auth.sessionGeneration;
      const countryId = this.selectedCountryId;
      this.species = [];
      this.mapAreas = [];
      this.selectedSpecies = null;
      this.speciesError = "";
      this.speciesId = "";
      this.loadingSpecies = false;
      this.page = 1;
      if (!this.canView) return;
      this.loadingSpecies = true;
      const current = () =>
        request === this.request &&
        auth.sessionGeneration === generation &&
        this.selectedCountryId === countryId &&
        this.canView;
      try {
        const [rows, areas] = await Promise.all([
          supabaseSpeciesInAreaRepository.fetchMapSpecies(countryId),
          supabaseFishingAreaRepository.fetchMapAreas(countryId),
        ]);
        if (current()) {
          this.species = rows;
          this.mapAreas = areas;
        }
      } catch {
        if (current()) this.speciesError = tr("FishingMapModal.loadError");
      } finally {
        if (request === this.request) this.loadingSpecies = false;
      }
    },
  },
});
