import { defineStore } from "pinia";
import { supabaseCurrencyRepository } from "../data/supabaseCurrencyRepository";
import { useAuthStore } from "./auth";

export const useCurrencyStore = defineStore("currency", {
  state: () => ({
    cash: 0,
    shells: 0,
    tickets: 0,
    loading: false,
    error: "",
  }),
  getters: {
    formattedCash: (state): string => {
      return state.cash.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    },
    formattedShells: (state): string => state.shells.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
    formattedTickets: (state): string => state.tickets.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
  },
  actions: {
    async fetchCurrency() {
      this.loading = true;
      this.error = "";
      try {
        const { cash, shells } = await supabaseCurrencyRepository.fetchMyCurrency();
        this.cash = cash;
        this.shells = shells ?? 0;
        this.tickets = await supabaseCurrencyRepository.fetchTickets(useAuthStore().userId);
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể lấy dữ liệu tiền tệ";
      } finally {
        this.loading = false;
      }
    },
  },
});
