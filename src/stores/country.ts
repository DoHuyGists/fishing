import { defineStore } from "pinia";
import { supabaseCountryRepository } from "../data/supabaseCountryRepository";

export interface Country {
  id: string; // uuid
  name: string; // text
  code: string; // character varying(10)
  information: string;
  created_at: string; // timestamp with time zone (ISO string)
  updated_at: string; // timestamp with time zone (ISO string)
}

export const useCountryStore = defineStore("Country", {
  state: () => ({
    countries: [] as Country[],
    isLoading: false,
    loaded: false,
  }),
  getters: {
    // for computed
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
  },
});
