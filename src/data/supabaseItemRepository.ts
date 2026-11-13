import { readCatalogPages } from './readCatalogPages';
import { RepositoryError } from './repositoryError';
import type { ItemRow, AdminItemRow, ItemPayload } from "../types/table/item";
import type { ShopItem, Item } from "../types/model/item";
import supabase from "../database/connection";
import { fetchAdminListPage } from './supabaseAdminListRepository';

function mapAdminItem(item: any): AdminItemRow {
  return {
    id: item.id, createdAt: item.created_at, updatedAt: item.updated_at,
    category: item.category, name: item.name, information: item.information, image: item.image,
    isDisabled: item.isDisabled, icon: item.icon, classification: item.classification,
    quantity: item.quantity == null ? null : Number(item.quantity), price: Number(item.price), rpc: item.rpc,
  };
}

class SupabaseItemRepository {
  async fetchPage(page: number, search: string, category: string, status: string) {
    const result = await fetchAdminListPage<any>('items', page, search, {
      ...(category === 'ALL' ? {} : { category }),
      ...(status === 'ALL' ? {} : { isDisabled: status === 'DISABLED' }),
    });
    return { ...result, items: result.items.map(mapAdminItem) };
  }
  async fetchByIds(ids: string[], signal?: AbortSignal): Promise<Item[]> {
    if (!ids.length) return [];
    const data = await readCatalogPages((from, to) => supabase.from("items").select("id,category,name,information,image,icon,price").in("id", ids).order("id").abortSignal(signal ?? new AbortController().signal).range(from, to));
    return data.map((item) => ({ ...item, price: Number(item.price) }));
  }

  async fetchShopItems(signal?: AbortSignal): Promise<ShopItem[]> {
    const data = await readCatalogPages((from, to) => supabase.from("items").select("id,category,classification,name,information,image,icon,quantity,price,rpc").eq("isDisabled", false).order("classification").order("name").order("id").abortSignal(signal ?? new AbortController().signal).range(from, to));
    return data.map((item) => ({ ...item, price: Number(item.price), quantity: item.quantity == null ? null : Number(item.quantity), rpc: item.rpc }));
  }

  async fetchAll(): Promise<AdminItemRow[]> {
    const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
    if (error) throw new RepositoryError(error);

    return data.map(mapAdminItem);
  }

  async create(payload: ItemPayload): Promise<void> {
    const { error } = await supabase.from("items").insert(payload);
    if (error) throw new RepositoryError(error);
  }

  async update(id: string, payload: ItemPayload): Promise<void> {
    const { error } = await supabase
      .from("items")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new RepositoryError(error);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) throw new RepositoryError(error);
  }

  async getReward(): Promise<ItemRow[]> {
    const { data, error } = await supabase.from("items").select("*").eq("isDisabled", false).order("created_at", { ascending: false });

    if (error) {
      throw new RepositoryError(error);
    }

    return data.map((x) => ({
      id: x.id,
      createdAt: x.created_at,
      category: x.category,
      name: x.name,
      information: x.information,
      image: x.image,
      updatedAt: x.updated_at,
      isDisabled: x.isDisabled,
    }));
  }
}

export const supabaseItemRepository = new SupabaseItemRepository();
