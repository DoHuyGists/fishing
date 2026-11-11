import { t as tr } from "../i18n";
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
    rewardProgress: (state) => {
      const rewards = (state.currentPass?.rewards ?? []).filter(
        (reward) => reward.reward_type === "FREE" || state.currentPass?.purchased,
      );
      return {
        claimed: rewards.filter((reward) => reward.claimed_at !== null).length,
        total: rewards.length,
      };
    },
  },
  actions: {
    async fetchCurrentPass() {
      this.loading = true;
      this.loadError = "";
      try {
        this.currentPass = await supabaseFishingPassRepository.fetchCurrentPass();
      } catch (err) {
        this.loadError = err instanceof Error ? err.message : tr('fishingPass.khong_the_tai_fishing_pass');
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
