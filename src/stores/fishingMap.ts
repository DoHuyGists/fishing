import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import { useCountryStore } from './country';
import type { Country } from './country';
import type { FishingMapArea, FishingMapAreaDetails, FishingMapSpecies } from '../types/model/fishingMap';
import { supabaseFishingAreaRepository } from '../data/supabaseFishingAreaRepository';
import { supabaseSpeciesInAreaRepository } from '../data/supabaseSpeciesInAreaRepository';
import { getFormattingLocale, t as tr } from '../i18n';

const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim();

export const useFishingMapStore = defineStore('fishingMap', {
  state: () => ({
    countrySearch: '', countryFilter: 'all', selectedCountryId: '',
    search: '', speciesId: '', sort: 'name', viewMode: 'grid' as 'list' | 'grid',
    species: [] as FishingMapSpecies[], mapAreas: [] as FishingMapAreaDetails[], selectedSpecies: null as FishingMapSpecies | null,
    loading: false, loadingSpecies: false,
    error: '', speciesError: '', request: 0, page: 1,
  }),
  getters: {
    unlockedIds(): Set<string> {
      const countries = useCountryStore();
      return new Set(countries.unlockedPlayerId === useAuthStore().user?.id && !countries.unlockedError
        ? countries.unlockedCountries.map(country => country.id) : []);
    },
    countries(): Country[] {
      const query = normalize(this.countrySearch);
      return useCountryStore().countries.filter(country =>
        normalize(`${country.name} ${country.code}`).includes(query)
        && (this.countryFilter === 'all' || this.unlockedIds.has(country.id) === (this.countryFilter === 'unlocked')))
        .sort((a, b) => Number(this.unlockedIds.has(b.id)) - Number(this.unlockedIds.has(a.id)));
    },
    selectedCountry(): Country | undefined {
      return useCountryStore().countries.find(country => country.id === this.selectedCountryId);
    },
    canView(): boolean {
      return Boolean(this.selectedCountry && this.unlockedIds.has(this.selectedCountryId));
    },
    speciesOptions(): { id: string; name: string }[] {
      if (!this.canView) return [];
      return [...new Map(this.species.map(row => [row.speciesId, { id: row.speciesId, name: row.speciesName ?? '' }])).values()]
        .sort((a, b) => a.name.localeCompare(b.name, getFormattingLocale()));
    },
    areas(): FishingMapArea[] {
      if (!this.canView) return [];
      const byArea = new Map<string, FishingMapSpecies[]>();
      for (const row of this.species) {
        const rows = byArea.get(row.areaId) ?? [];
        if (!rows.some(item => item.speciesId === row.speciesId)) rows.push(row);
        byArea.set(row.areaId, rows);
      }
      const query = normalize(this.search);
      return this.mapAreas.filter(area => area.countryId === this.selectedCountryId)
        .map(area => ({ ...area, species: byArea.get(area.id) ?? [] }))
        .filter(area => (!this.speciesId || area.species.some(row => row.speciesId === this.speciesId))
          && (!query || normalize(area.title ?? '').includes(query) || area.species.some(row => normalize(row.speciesName ?? '').includes(query))))
        .sort((a, b) => (this.sort === 'species' ? b.species.length - a.species.length : 0)
          || (a.title ?? '').localeCompare(b.title ?? '', getFormattingLocale()));
    },
    totalPages(): number { return Math.max(1, Math.ceil(this.areas.length / 12)); },
    pagedAreas(): FishingMapArea[] { return this.areas.slice((this.page - 1) * 12, this.page * 12); },
  },
  actions: {
    selectCountry(id: string) {
      if (!this.unlockedIds.has(id)) return;
      this.selectedCountryId = id;
      this.search = ''; this.speciesId = ''; this.page = 1;
    },
    async load(force = false) {
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      this.loading = true; this.error = '';
      const countries = useCountryStore();
      await Promise.all([countries.fetchCountries(force), countries.fetchMyUnlockedCountries(auth.user?.id ?? null, force)]);
      if (auth.sessionGeneration !== generation) return;
      this.loading = false;
      if (!countries.loaded || countries.unlockedError) this.error = tr('FishingMapModal.loadError');
      if (!this.canView) this.selectedCountryId = countries.countries.find(country => this.unlockedIds.has(country.id))?.id ?? '';
    },
    async loadSpecies() {
      const request = ++this.request, auth = useAuthStore(), generation = auth.sessionGeneration;
      const countryId = this.selectedCountryId;
      this.species = []; this.mapAreas = []; this.selectedSpecies = null;
      this.speciesError = ''; this.speciesId = ''; this.loadingSpecies = false; this.page = 1;
      if (!this.canView) return;
      this.loadingSpecies = true;
      const current = () => request === this.request && auth.sessionGeneration === generation && this.selectedCountryId === countryId && this.canView;
      try {
        const [rows, areas] = await Promise.all([
          supabaseSpeciesInAreaRepository.fetchMapSpecies(countryId),
          supabaseFishingAreaRepository.fetchMapAreas(countryId),
        ]);
        if (current()) { this.species = rows; this.mapAreas = areas; }
      } catch {
        if (current()) this.speciesError = tr('FishingMapModal.loadError');
      } finally {
        if (request === this.request) this.loadingSpecies = false;
      }
    },
  },
});
