import { useGameCatalogStore } from './gameCatalog';
import type { CurrencyConversionRate } from "../types/model/currency";
import { getFormattingLocale, t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseCurrencyRepository } from "../data/supabaseCurrencyRepository";
import { useAuthStore } from "./auth";
import { useToast } from "../composables/useToast";

import { createKeyedRefreshTask } from '../utils/refreshTask';
const refreshWallet = createKeyedRefreshTask<Awaited<ReturnType<typeof supabaseCurrencyRepository.fetchWallet>>>();

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
    async fetchConversionRates(force = false) {
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      this.conversionRatesLoading = true;
      this.conversionRatesError = "";
      try {
        await useGameCatalogStore().get('rates', { force, consumer: 'currency', onUpdate: data => { this.conversionRates = data ?? []; if (!data) { this.conversionRatesLoading = false; this.conversionRatesError = ''; this.conversionBatches = {}; } } });
        if (auth.sessionGeneration !== generation) return;
        for (const rate of this.conversionRates) {
          const key = `${rate.source_currency}-${rate.target_currency}`;
          this.conversionBatches[key] ??= 1;
        }
      } catch (error) {
        if (auth.sessionGeneration === generation) this.conversionRatesError = error instanceof Error ? error.message : tr('currency.khong_the_tai_ty_gia_quy_doi');
      } finally {
        if (auth.sessionGeneration === generation) this.conversionRatesLoading = false;
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
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      this.converting = true;
      try {
        const batches = this.conversionAmounts(rate).batches;
        const wallet = await useGameCatalogStore().action('convert_currency', { p_source_currency: rate.source_currency, p_target_currency: rate.target_currency,
          p_batches: batches, p_source_amount: rate.source_amount, p_target_amount: rate.target_amount }, ['rates'],
          () => supabaseCurrencyRepository.convertCurrency(rate, batches));
        if (auth.sessionGeneration !== generation) return;
        this.cash = wallet.cash;
        this.shells = wallet.shells;
        this.tickets = wallet.tickets;
        useToast().success(tr('currency.quy_doi_tien_te_thanh_cong'));
      } catch (error) {
        if (auth.sessionGeneration !== generation) return;
        useToast().error(error instanceof Error ? error.message : tr('currency.khong_the_quy_doi_tien_te'));
        await this.fetchConversionRates();
        await this.fetchCurrency();
      } finally {
        if (auth.sessionGeneration === generation) this.converting = false;
      }
    },
    async fetchCurrency(invalidate = false) {
      const auth = useAuthStore();
      const userId = auth.user?.id;
      const generation = auth.sessionGeneration;
      if (!userId) return;
      const current = () => auth.user?.id === userId && auth.sessionGeneration === generation;
      this.loading = true; this.error = '';
      try {
        const wallet = await refreshWallet(userId + ':' + generation,
          () => supabaseCurrencyRepository.fetchWallet(userId), invalidate);
        if (!current()) return;
        this.cash = wallet.cash; this.shells = wallet.shells; this.tickets = wallet.tickets;
      } catch (err) {
        if (current()) this.error = err instanceof Error ? err.message : tr('currency.khong_the_lay_du_lieu_tien_te');
      } finally { if (current()) this.loading = false; }
    },
  },
});
