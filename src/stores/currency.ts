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
    async fetchCurrency() {
      this.loading = true;
      this.error = "";
      try {
        const {cash} = await supabaseCurrencyRepository.fetchMyCurrency();
        this.cash = cash;
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể lấy dữ liệu tiền tệ";
      } finally {
        this.loading = false;
      }
    },
  },
});
