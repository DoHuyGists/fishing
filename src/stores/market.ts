import { defineStore } from "pinia";
import { supabaseMarketRepository, type MarketListing } from "../data/supabaseMarketRepository";

export const useMarketStore = defineStore("market", {
    state: () => ({
        isLoadingMarket: false,
        marketListings: [] as MarketListing[]
    }),
    actions: {
        async loadMarketListings() {
            this.isLoadingMarket = true;
            try {
                const data = await supabaseMarketRepository.fetchActiveListings();
                this.marketListings = data;
            } catch (err) {
                console.error("Lỗi khi tải chợ cá:", err);
            } finally {
                this.isLoadingMarket = false;
            }
        }

    }
})

