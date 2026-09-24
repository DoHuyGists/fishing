import supabase from "../database/connection";
import { supabaseCurrencyRepository } from "./supabaseCurrencyRepository";

export interface MarketListing {
  id: number;
  created_at: string;
  item_id: string;
  user_id: string;
  price: number;
  status: string;
  caught?: {
    id: string;
    user_id: string;
    area_id: string;
    fish: any;
    created_at: string;
  };
}

class SupabaseMarketRepository {
  async fetchActiveListings(): Promise<MarketListing[]> {
    try {
      const { data, error } = await supabase
        .from("market")
        .select("id, created_at, item_id, user_id, price, status, caught:item_id (id, user_id, area_id, fish, created_at)")
        .eq("status", "normal")
        .order("created_at", { ascending: false });

      if (error) {
        return this.fetchActiveListingsFallback();
      }

      const list = (data as any[]) ?? [];
      const missingItemIds = list.filter((m) => !m.caught).map((m) => m.item_id);

      if (missingItemIds.length > 0) {
        const { data: caughtData } = await supabase
          .from("caught")
          .select("id, user_id, area_id, fish, created_at")
          .in("id", missingItemIds);

        const caughtMap = new Map((caughtData ?? []).map((c: any) => [c.id, c]));
        return list.map((m) => ({
          ...m,
          caught: m.caught ?? caughtMap.get(m.item_id),
        }));
      }

      return list;
    } catch {
      return this.fetchActiveListingsFallback();
    }
  }

  private async fetchActiveListingsFallback(): Promise<MarketListing[]> {
    const { data: rawData, error: rawError } = await supabase
      .from("market")
      .select("*")
      .eq("status", "normal")
      .order("created_at", { ascending: false });

    if (rawError || !rawData || rawData.length === 0) return [];

    const itemIds = rawData.map((m) => m.item_id);
    const { data: caughtData } = await supabase
      .from("caught")
      .select("id, user_id, area_id, fish, created_at")
      .in("id", itemIds);

    const caughtMap = new Map((caughtData ?? []).map((c: any) => [c.id, c]));
    return rawData.map((m) => ({
      ...m,
      caught: caughtMap.get(m.item_id),
    }));
  }

  async cancelListing(marketId: number, caughtId: string): Promise<void> {
    const { error: marketError } = await supabase
      .from("market")
      .update({ status: "cancelled" })
      .eq("id", marketId);

    if (marketError) throw new Error(marketError.message);

    const { error: caughtError } = await supabase
      .from("caught")
      .update({ status: "normal" })
      .eq("id", caughtId);

    if (caughtError) throw new Error(caughtError.message);
  }

  async buyFish(buyerId: string, marketItem: MarketListing): Promise<void> {
    if (!buyerId) throw new Error("Bạn chưa đăng nhập");
    if (buyerId === marketItem.user_id) throw new Error("Bạn không thể mua cá do chính mình đăng bán");

    const buyerCash = await supabaseCurrencyRepository.fetchCurrencyByUserId(buyerId);
    if (buyerCash < marketItem.price) {
      throw new Error(`Bạn không đủ tiền! Cần thêm ${(marketItem.price - buyerCash).toLocaleString("vi-VN")} đ nữa.`);
    }

    // Trừ tiền người mua
    await supabaseCurrencyRepository.updateCurrency(buyerId, buyerCash - marketItem.price);

    // Cộng tiền cho người bán
    try {
      await supabaseCurrencyRepository.addCash(marketItem.user_id, marketItem.price);
    } catch (err) {
      console.warn("Không thể cộng tiền cho người bán:", err);
    }

    // Đánh dấu đã bán trong bảng market
    const { error: marketError } = await supabase
      .from("market")
      .update({ status: "sold" })
      .eq("id", marketItem.id);

    if (marketError) throw new Error(marketError.message);

    // Chuyển quyền sở hữu cá sang cho người mua & chuyển status về 'normal'
    const { error: caughtError } = await supabase
      .from("caught")
      .update({ user_id: buyerId, status: "normal" })
      .eq("id", marketItem.item_id);

    if (caughtError) throw new Error(caughtError.message);
  }
}

export const supabaseMarketRepository = new SupabaseMarketRepository();
