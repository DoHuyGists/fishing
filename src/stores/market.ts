import type { MarketListing, MarketHistory } from "../types/model/market";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseMarketRepository } from "../data/supabaseMarketRepository";
import type { RealtimeChannel } from "@supabase/supabase-js";
let channel: RealtimeChannel | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let reconciliationTimer: ReturnType<typeof setInterval> | undefined;

export const useMarketStore = defineStore("species_market", {
  state: () => ({
    isLoadingMarket: false,
    marketListings: [] as MarketListing[],
    error: "",
    history: [] as MarketHistory[],
    historyPage: 1,
    historyHasNext: false,
    historyLoading: false,
    historyError: "",
    historyRequest: 0,
    listingRequest: 0,
    realtimeOwner: "",
  }),
  actions: {
    async loadHistory(userId: string, page?: number) {
      page ??= this.historyPage;
      const request = ++this.historyRequest;
      this.historyLoading = true; this.historyError = "";
      try {
        const rows = await supabaseMarketRepository.fetchHistory(userId, page);
        if (request !== this.historyRequest) return;
        this.history = rows.slice(0, 20); this.historyPage = page; this.historyHasNext = rows.length > 20;
      } catch (err) { if (request === this.historyRequest) this.historyError = err instanceof Error ? err.message : tr('market.khong_the_tai_lich_su'); }
      finally { if (request === this.historyRequest) this.historyLoading = false; }
    },
    startRealtime(userId: string) {
      this.stopRealtime();
      this.realtimeOwner = userId;
      this.marketListings = [];
      this.history = []; this.historyPage = 1;
      channel = supabaseMarketRepository.subscribe(userId, () => {
        if (this.realtimeOwner !== userId) return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => { if (this.realtimeOwner === userId) { void this.loadMarketListings(); void this.loadHistory(userId); } }, 250);
      });
      // Recover missed events, including updates hidden by a listing's SELECT policy.
      reconciliationTimer = setInterval(() => {
        if (this.realtimeOwner === userId && document.visibilityState === 'visible') {
          void this.loadMarketListings(); void this.loadHistory(userId);
        }
      }, 30_000);
    },
    stopRealtime() {
      this.realtimeOwner = "";
      ++this.listingRequest;
      clearTimeout(refreshTimer);
      clearInterval(reconciliationTimer);
      ++this.historyRequest;
      if (channel) void supabaseMarketRepository.unsubscribe(channel);
      channel = null;
    },
    async loadMarketListings() {
      const request = ++this.listingRequest;
      this.isLoadingMarket = true;
      this.error = "";
      try {
        const data = await supabaseMarketRepository.fetchActiveListings();
        if (request !== this.listingRequest) return;
        this.marketListings = data;
      } catch (err) {
        if (request === this.listingRequest) this.error = err instanceof Error ? err.message : tr('market.khong_the_tai_cho_ca');
      } finally {
        if (request === this.listingRequest) this.isLoadingMarket = false;
      }
    },
  },
});
