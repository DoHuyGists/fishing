import type { MarketListing, MarketHistory, MarketListingQuery } from "../types/model/market";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseMarketRepository } from "../data/supabaseMarketRepository";
import { useAuthStore } from './auth';
import { useReadCacheStore } from './readCache';
import { createKeyedRefreshTask } from '../utils/refreshTask';
import { startVisibleRefresh } from '../utils/visibleRefresh';
import { LIST_PAGE_SIZE } from '../data/pagination';
import type { ListPage } from '../types/model/pagination';
const refreshListings = createKeyedRefreshTask<ListPage<MarketListing>>();
const refreshHistory = createKeyedRefreshTask<ListPage<MarketHistory>>();
let stopRefresh: (() => void) | null = null;

export const useMarketStore = defineStore("species_market", {
  state: () => ({
    isLoadingMarket: false, marketListings: [] as MarketListing[], error: '',
    history: [] as MarketHistory[], historyPage: 1, historyHasNext: false,
    historyLoading: false, historyError: '', historyRequest: 0, listingRequest: 0,
    ownerId: '', activeTab: 'all' as 'all' | 'my' | 'history',
    search: '', rarity: 'ALL', sort: 'newest' as MarketListingQuery['sort'],
    listingPage: 1, listingHasNext: false,
  }),
  actions: {
    async loadHistory(userId: string, page?: number, invalidate = false) {
      page ??= this.historyPage;
      const auth = useAuthStore();
      const generation = auth.sessionGeneration;
      this.historyPage = Math.max(1, page);
      const request = ++this.historyRequest;
      const current = () => request === this.historyRequest && auth.user?.id === userId && auth.sessionGeneration === generation;
      this.historyLoading = true; this.historyError = '';
      try {
        if (invalidate) { await useReadCacheStore().invalidate(['history']); if (!current()) return; }
        const rows = await refreshHistory(userId + ':' + generation + ':' + page,
          () => supabaseMarketRepository.fetchHistory(userId, page), invalidate);
        if (!current()) return;
        this.history = rows.items; this.historyHasNext = this.historyPage * LIST_PAGE_SIZE < rows.total;
        if (!rows.items.length && rows.total > 0 && this.historyPage > 1) await this.loadHistory(userId, Math.ceil(rows.total / LIST_PAGE_SIZE));
      } catch (err) { if (current()) this.historyError = err instanceof Error ? err.message : tr('market.khong_the_tai_lich_su'); }
      finally { if (current()) this.historyLoading = false; }
    },
    startRefreshing(userId: string) {
      this.stopRefreshing();
      this.ownerId = userId;
      this.marketListings = []; this.history = [];
      this.error = ''; this.historyError = ''; this.listingHasNext = false; this.historyHasNext = false;
      this.historyPage = 1; this.listingPage = 1; this.activeTab = 'all';
      stopRefresh = startVisibleRefresh(async () => {
        await this.loadVisible();
        const failure = this.activeTab === 'history' ? this.historyError : this.error;
        if (failure) throw new Error(failure);
      }, 30_000);
    },
    stopRefreshing() {
      this.ownerId = ''; ++this.listingRequest; ++this.historyRequest;
      stopRefresh?.(); stopRefresh = null;
      this.isLoadingMarket = false; this.historyLoading = false;
    },
    async loadVisible() {
      const userId = useAuthStore().user?.id;
      if (!userId) return;
      if (this.activeTab === 'history') await this.loadHistory(userId);
      else await this.loadMarketListings();
    },
    async loadMarketListings(invalidate = false) {
      const auth = useAuthStore();
      const userId = auth.user?.id;
      if (!userId) return;
      const generation = auth.sessionGeneration;
      const query: MarketListingQuery = {
        page: this.listingPage, pageSize: LIST_PAGE_SIZE,
        userId: this.activeTab === 'my' ? userId : undefined,
        search: this.activeTab === 'my' ? '' : this.search.trim(),
        rarity: this.activeTab === 'my' ? 'ALL' : this.rarity, sort: this.sort,
      };
      const request = ++this.listingRequest;
      const current = () => request === this.listingRequest && auth.user?.id === userId && auth.sessionGeneration === generation;
      this.isLoadingMarket = true; this.error = '';
      try {
        if (invalidate) { await useReadCacheStore().invalidate(['market', 'caught']); if (!current()) return; }
        const rows = await refreshListings(userId + ':' + generation + ':' + JSON.stringify(query),
          () => supabaseMarketRepository.fetchActiveListings(query), invalidate);
        if (!current()) return;
        this.marketListings = rows.items; this.listingHasNext = this.listingPage * LIST_PAGE_SIZE < rows.total;
        if (!rows.items.length && this.listingPage > 1) {
          this.listingPage = Math.max(1, Math.ceil(rows.total / LIST_PAGE_SIZE));
          await this.loadMarketListings();
        }
      } catch (err) { if (current()) this.error = err instanceof Error ? err.message : tr('market.khong_the_tai_cho_ca'); }
      finally { if (current()) this.isLoadingMarket = false; }
    },
  },
});
