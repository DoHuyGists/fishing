import supabase from "../database/connection";

export interface UserInventory {
  id: string;
  data: any;
  userId: string;
  createdAt: any;
  rpc: string | null;
}

class SupabaseUserInventoryRepository {
  async fetchUserInventory(userId: string): Promise<UserInventory[]> {
    const { data, error } = await supabase.from("user_inventory").select("*").eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    return data.map(
      (x) =>
        ({
          id: x.id,
          data: x.data,
          userId: x.user_id,
          createdAt: x.created_at,
          rpc: x.rpc,
        }) as UserInventory,
    );
  }
  async claimRandomItem(itemIds: string[]): Promise<string> {
    const { data, error } = await supabase.rpc("spin_wheel", {
      p_item_ids: itemIds,
    });
    if (error) {
      throw new Error(error.message);
    }
    return data.item_id;
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
  async deleteInventory(userId: string, inventoryIds: string[]) {
    const { error } = await supabase.from("user_inventory").delete().in("id", inventoryIds).eq("user_id", userId);
    if (error) {
      throw new Error(error.message);
    }
  }
}
export const supabaseUserInventoryRepository = new SupabaseUserInventoryRepository();
