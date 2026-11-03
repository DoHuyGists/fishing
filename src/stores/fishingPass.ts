import { defineStore } from "pinia";
import { supabaseCurrencyRepository } from "../data/supabaseCurrencyRepository";
import { useCurrencyStore } from "./currency";

export const useFishingPassStore = defineStore("fishingPass", {
  state: () => ({
    price: 300,
    hasFishingPass: false,
    isBuying: false,
  }),
  actions: {
    async buyFishingPass() {
      const currencyStore = useCurrencyStore();
      if (currencyStore.shells < this.price || this.isBuying) return false;
      this.isBuying = true;
      try {
        await supabaseCurrencyRepository.buyFishingPass();
        await currencyStore.fetchCurrency();
        this.hasFishingPass = true;
        return true;
      } finally {
        this.isBuying = false;
      }
    },
  },
});
