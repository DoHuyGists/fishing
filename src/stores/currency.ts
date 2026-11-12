import type { CurrencyConversionRate } from "../types/model/currency";
import { getFormattingLocale, t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseCurrencyRepository } from "../data/supabaseCurrencyRepository";
import { useAuthStore } from "./auth";
import { useToast } from "../composables/useToast";

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
    conversionBatches: {} as Record<string, number>,
  }),
  getters: {
    formattedCash: (state): string => {
      return state.cash.toLocaleString(getFormattingLocale());
    },
    formattedShells: (state): string => state.shells.toLocaleString(getFormattingLocale()),
    formattedTickets: (state): string => state.tickets.toLocaleString(getFormattingLocale()),
  },
  actions: {
    adjustConversionBatches(rate: CurrencyConversionRate, change: number) {
      if (this.converting) return;
      const key = `${rate.source_currency}-${rate.target_currency}`;
      const current = Number(this.conversionBatches[key]);
      this.conversionBatches[key] = Number.isFinite(current)
        ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Math.floor(current) + change))
        : 1;
    },
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
        this.conversionRatesError = error instanceof Error ? error.message : tr('currency.khong_the_tai_ty_gia_quy_doi');
      } finally {
        this.conversionRatesLoading = false;
      }
    },
    conversionAmounts(rate: CurrencyConversionRate) {
      const batches = this.conversionBatches[`${rate.source_currency}-${rate.target_currency}`] ?? 1;
      return { batches, cost: batches * rate.source_amount, received: batches * rate.target_amount };
    },
    hasValidConversionAmounts(rate: CurrencyConversionRate): boolean {
      const { batches, cost, received } = this.conversionAmounts(rate);
      return Number.isSafeInteger(batches) && batches > 0
        && Number.isSafeInteger(cost) && cost > 0
        && Number.isSafeInteger(received) && received > 0;
    },
    canConvert(rate: CurrencyConversionRate): boolean {
      return !this.converting && !this.loading && !this.error && !this.conversionRatesLoading && !this.conversionRatesError
        && this.hasValidConversionAmounts(rate)
        && this[rate.source_currency] >= this.conversionAmounts(rate).cost;
    },
    async convertCurrency(rate: CurrencyConversionRate) {
      if (!this.canConvert(rate)) return;
      this.converting = true;
      try {
        const wallet = await supabaseCurrencyRepository.convertCurrency(rate, this.conversionAmounts(rate).batches);
        this.cash = wallet.cash;
        this.shells = wallet.shells;
        this.tickets = wallet.tickets;
        useToast().success(tr('currency.quy_doi_tien_te_thanh_cong'));
      } catch (error) {
        useToast().error(error instanceof Error ? error.message : tr('currency.khong_the_quy_doi_tien_te'));
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
        this.error = err instanceof Error ? err.message : tr('currency.khong_the_lay_du_lieu_tien_te');
      } finally {
        this.loading = false;
      }
    },
  },
});
