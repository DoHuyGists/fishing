import { defineStore } from "pinia";
import { supabaseCurrencyRepository, type CurrencyConversionRate } from "../data/supabaseCurrencyRepository";
import { useAuthStore } from "./auth";

export const useCurrencyStore = defineStore("currency", {
  state: () => ({
    cash: 0,
    shells: 0,
    tickets: 0,
    loading: false,
    error: "",
    conversionRates: [] as CurrencyConversionRate[],
    conversionRatesLoading: false,
    conversionRatesError: "",
    converting: false,
    conversionNotice: null as { type: "success" | "error"; text: string } | null,
    conversionBatches: {} as Record<string, number>,
  }),
  getters: {
    formattedCash: (state): string => {
      return state.cash.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    },
    formattedShells: (state): string => state.shells.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
    formattedTickets: (state): string => state.tickets.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
  },
  actions: {
    async fetchConversionRates() {
      if (this.conversionRatesLoading) return;
      this.conversionRatesLoading = true;
      this.conversionRatesError = "";
      try {
        this.conversionRates = await supabaseCurrencyRepository.fetchConversionRates();
        for (const rate of this.conversionRates) {
          const key = `${rate.source_currency}-${rate.target_currency}`;
          this.conversionBatches[key] ??= 1;
        }
      } catch (error) {
        this.conversionRatesError = error instanceof Error ? error.message : "Không thể tải tỷ giá quy đổi.";
      } finally {
        this.conversionRatesLoading = false;
      }
    },
    conversionAmounts(rate: CurrencyConversionRate) {
      const batches = this.conversionBatches[`${rate.source_currency}-${rate.target_currency}`] ?? 1;
      return { batches, cost: batches * rate.source_amount, received: batches * rate.target_amount };
    },
    canConvert(rate: CurrencyConversionRate): boolean {
      const { batches, cost, received } = this.conversionAmounts(rate);
      return !this.converting && !this.loading && !this.error && !this.conversionRatesLoading && !this.conversionRatesError
        && Number.isSafeInteger(batches) && batches > 0
        && Number.isSafeInteger(cost) && cost > 0
        && Number.isSafeInteger(received) && received > 0 && this[rate.source_currency] >= cost;
    },
    async convertCurrency(rate: CurrencyConversionRate) {
      if (!this.canConvert(rate)) return;
      this.converting = true;
      this.conversionNotice = null;
      try {
        const wallet = await supabaseCurrencyRepository.convertCurrency(rate, this.conversionAmounts(rate).batches);
        this.cash = wallet.cash;
        this.shells = wallet.shells;
        this.tickets = wallet.tickets;
        this.conversionNotice = { type: "success", text: "Quy đổi tiền tệ thành công!" };
      } catch (error) {
        this.conversionNotice = { type: "error", text: error instanceof Error ? error.message : "Không thể quy đổi tiền tệ." };
        await this.fetchConversionRates();
        await this.fetchCurrency();
      } finally {
        this.converting = false;
      }
    },
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
