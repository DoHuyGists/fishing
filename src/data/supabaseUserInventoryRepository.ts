import type { UserInventory } from "../types/model/userInventory";
import type { SpinWheelResult } from "../types/model/spinWheel";
import supabase from "../database/connection";
import { escapeLike, listPage, pageRange } from './pagination';
import type { InventoryClassification } from '../types/model/inventory';

const mapInventory = (row: any): UserInventory => ({ id: row.id, data: row.data, userId: row.user_id, createdAt: row.created_at, rpc: row.rpc });


class SupabaseUserInventoryRepository {
  async fetchPage(userId: string, page: number, search: string, categories: string[], classification?: InventoryClassification) {
    let query = supabase.from('user_inventory').select('*', { count: 'exact' }).eq('user_id', userId);
    let totalQuery = supabase.from('user_inventory').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if (classification) {
      query = query.eq('data->>classification', classification);
      totalQuery = totalQuery.eq('data->>classification', classification);
    }
    if (search.trim()) {
      const pattern = `"%${escapeLike(search).replace(/"/g, '\\"')}%"`;
      query = query.or(`data->>name.ilike.${pattern},data->>category.ilike.${pattern}${categories.length ? `,data->>category.in.(${categories.join(',')})` : ''}`);
    }
    const [result, total] = await Promise.all([
      query.order('created_at', { ascending: false }).order('id').range(...pageRange(page)),
      totalQuery,
    ]);
    if (result.error) throw new Error(result.error.message);
    if (total.error) throw new Error(total.error.message);
    return { ...listPage((result.data ?? []).map(mapInventory), result.count), ownedTotal: total.count ?? 0 };
  }
  async fetchUserInventory(userId: string): Promise<UserInventory[]> {
    const { data, error } = await supabase.from("user_inventory").select("*").eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    return data.map(mapInventory);
  }
  async claimRandomItem(): Promise<SpinWheelResult> {
    const { data, error } = await supabase.rpc("spin_wheel");
    if (error) {
      throw new Error(error.message);
    }
    return data;
  }
  async purchaseItem(itemId: string, quantity: number): Promise<void> {
    const { error } = await supabase.rpc("purchase_item", { p_item_id: itemId, p_quantity: quantity });
    if (error) throw new Error(error.message);
  }
  async useItem(inventoryId: string): Promise<unknown> {
    const { data, error } = await supabase.rpc("use_inventory_item", {
      p_inventory_id: inventoryId,
    });
    if (error) {
      throw new Error(error.message);
    }
    return data;
  }
  async deleteInventory(_userId: string, inventoryIds: string[]) {
    const { error } = await supabase.rpc("delete_inventory_items", {
      p_inventory_ids: inventoryIds,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
}
export const supabaseUserInventoryRepository = new SupabaseUserInventoryRepository();
