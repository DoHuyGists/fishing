import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseCountryRepository } from "../data/supabaseCountryRepository";
import { getWorldMapCountryId } from "../data/worldMapCountries";
import { useAuthStore } from "./auth";

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
      if (this.loaded && !force) return;
      this.isLoading = true;
      try {
        this.countries = await supabaseCountryRepository.fetchCountries();
        this.loaded = true;
      } catch (error) {
        console.error("Failed to fetch countries:", error);
      } finally {
        this.isLoading = false;
      }
    },
    async fetchMyUnlockedCountries(playerId = useAuthStore().user?.id ?? null) {
      const request = ++this.unlockedRequest;
      if (this.unlockedPlayerId !== playerId || !playerId) this.unlockedCountries = [];
      this.unlockedPlayerId = playerId;
      this.unlockedError = "";
      this.isLoadingUnlocked = Boolean(playerId);
      if (!playerId) return;

      const isCurrentRequest = () => request === this.unlockedRequest
        && useAuthStore().user?.id === playerId;
      try {
        const countries = await supabaseCountryRepository.fetchMyUnlockedCountries(playerId);
        if (isCurrentRequest()) this.unlockedCountries = countries;
      } catch (error) {
        if (isCurrentRequest()) {
          this.unlockedError = tr('country.khong_the_tai_quoc_gia_da_mo_khoa_vui_long_thu_lai');
          console.error("Failed to fetch unlocked countries:", error);
        }
      } finally {
        if (isCurrentRequest()) this.isLoadingUnlocked = false;
      }
    },
    watchUnlockedCountries(playerId: string | null): () => void {
      void this.fetchMyUnlockedCountries(playerId);
      if (!playerId) return () => {};
      return supabaseCountryRepository.subscribeToUnlockedCountries(playerId, () => {
        if (useAuthStore().user?.id === playerId) void this.fetchMyUnlockedCountries(playerId);
      });
    },
  },
});
