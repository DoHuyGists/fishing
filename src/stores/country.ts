import { useGameCatalogStore } from './gameCatalog';
import { useReadCacheStore } from './readCache';
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseCountryRepository } from "../data/supabaseCountryRepository";
import { getWorldMapCountryId } from "../data/worldMapCountries";
import { useAuthStore } from "./auth";

import { createKeyedRefreshTask } from '../utils/refreshTask';
import { startVisibleRefresh } from '../utils/visibleRefresh';
const refreshCountries = createKeyedRefreshTask<Country[]>();

export interface Country {
  id: string; // uuid
  name: string; // text
  code: string; // character varying(10)
  information: string;
  created_at: string; // timestamp with time zone (ISO string)
  updated_at: string; // timestamp with time zone (ISO string)
  location: { k: number; lon: number; lat: number } | null;
}

export const useCountryStore = defineStore("Country", {
  state: () => ({
    countries: [] as Country[],
    isLoading: false,
    loaded: false,
    unlockedCountries: [] as Country[],
    unlockedPlayerId: null as string | null,
    unlockedRequest: 0,
    isLoadingUnlocked: false,
    unlockedError: "",
  }),
  getters: {
    getCountryName: (state) => (countryId?: string | null): string =>
      state.countries.find((country) => country.id === countryId)?.name
        || (countryId && state.isLoading ? tr('UserProfile.dang_tai_quoc_gia') : tr('country.chua_co_thong_tin_quoc_gia')),
    unlockedWorldMapCountryIds: (state): string[] => state.unlockedCountries
      .map((country) => getWorldMapCountryId(country.code))
      .filter((id): id is string => id !== null),
  },
  actions: {
    async fetchCountries(force = false) {
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      this.isLoading = true;
      try {
        await useGameCatalogStore().get('countries', { force, consumer: 'country', onUpdate: data => { this.countries = data ?? []; this.loaded = Boolean(data); if (!data) this.isLoading = false; } });
      } catch (error) {
        if (auth.sessionGeneration === generation) console.error("Failed to fetch countries:", error);
      } finally {
        if (auth.sessionGeneration === generation) this.isLoading = false;
      }
    },
    async fetchMyUnlockedCountries(playerId = useAuthStore().user?.id ?? null, invalidate = false) {
      const generation = useAuthStore().sessionGeneration;
      if (invalidate) await useReadCacheStore().invalidate(['unlocked']);
      if (useAuthStore().sessionGeneration !== generation) return;
      const request = ++this.unlockedRequest;
      if (this.unlockedPlayerId !== playerId || !playerId) this.unlockedCountries = [];
      this.unlockedPlayerId = playerId; this.unlockedError = ''; this.isLoadingUnlocked = Boolean(playerId);
      if (!playerId) return;
      const current = () => request === this.unlockedRequest && useAuthStore().user?.id === playerId
        && useAuthStore().sessionGeneration === generation;
      try {
        const countries = await refreshCountries(playerId + ':' + generation,
          () => supabaseCountryRepository.fetchMyUnlockedCountries(playerId), invalidate);
        if (current()) this.unlockedCountries = countries;
      } catch (error) {
        if (current()) {
          this.unlockedError = tr('country.khong_the_tai_quoc_gia_da_mo_khoa_vui_long_thu_lai');
          console.error('Failed to fetch unlocked countries:', error);
        }
      } finally { if (current()) this.isLoadingUnlocked = false; }
    },
    watchUnlockedCountries(playerId: string | null): () => void {
      if (!playerId) { void this.fetchMyUnlockedCountries(null); return () => {}; }
      return startVisibleRefresh(async () => {
        await this.fetchMyUnlockedCountries(playerId);
        if (this.unlockedError) throw new Error(this.unlockedError);
      }, 60_000);
    },
  },
});
