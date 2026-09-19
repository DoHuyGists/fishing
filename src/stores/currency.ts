import { defineStore } from "pinia";
import { supabaseCurrencyRepository } from "../data/supabaseCurrencyRepository";

export const useCurrencyStore = defineStore("currency", {
  state: () => ({
    cash: 0,
    loading: false,
    error: "",
  }),
  getters: {
    formattedCash: (state): string => {
      return state.cash.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    },
  },
  actions: {
    async fetchCurrency(userId: string) {
      if (!userId) return;
      this.loading = true;
      this.error = "";
      try {
        this.cash = await supabaseCurrencyRepository.fetchCurrencyByUserId(userId);
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể lấy dữ liệu tiền tệ";
      } finally {
        this.loading = false;
      }
    },
  },
});
