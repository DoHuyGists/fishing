import { defineStore } from "pinia";
import { supabaseCurrencyRepository } from "../data/supabaseCurrencyRepository";
import { supabaseFishingPassRepository, type FishingPass } from "../data/supabaseFishingPassRepository";
import { useCurrencyStore } from "./currency";

export const useFishingPassStore = defineStore("fishingPass", {
  state: () => ({
    currentPass: null as FishingPass | null,
    loading: false,
    loadError: "",
    isBuying: false,
  }),
  getters: {
    price: (state) => state.currentPass?.price ?? 0,
    hasFishingPass: (state) => Boolean(state.currentPass?.purchased),
  },
  actions: {
    async fetchCurrentPass() {
      this.loading = true;
      this.loadError = "";
      try {
        this.currentPass = await supabaseFishingPassRepository.fetchCurrentPass();
      } catch (err) {
        this.loadError = err instanceof Error ? err.message : "Không thể tải Fishing Pass.";
        throw err;
      } finally {
        this.loading = false;
      }
    },
    async claimReward(rewardId: string) {
      await supabaseFishingPassRepository.claimReward(rewardId);
      await this.fetchCurrentPass();
    },
    async buyFishingPass() {
      const currencyStore = useCurrencyStore();
      if (!this.currentPass || currencyStore.shells < this.price || this.isBuying) return false;
      this.isBuying = true;
      try {
        await supabaseCurrencyRepository.buyFishingPass();
        await Promise.all([currencyStore.fetchCurrency(), this.fetchCurrentPass()]);
        return this.hasFishingPass;
      } finally {
        this.isBuying = false;
      }
    },
  },
});
