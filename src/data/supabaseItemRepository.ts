import supabase from "../database/connection";

export interface ItemRow {
  id: string;
  createdAt: string;
  category: string;
  name: string;
  information: string;
  image: string;
  updatedAt: string;
  isDisabled: boolean;
}

export interface AdminItemRow {
  id: string;
  createdAt: string;
  category: string | null;
  name: string;
  information: string;
  image: string | null;
  updatedAt: string | null;
  isDisabled: boolean | null;
  icon: string | null;
  classification: string | null;
  quantity: number | null;
  price: number;
  rpc: string | null;
}

export interface ShopItem {
  id: string;
  category: string | null;
  classification: string | null;
  name: string;
  information: string;
  image: string | null;
  icon: string | null;
  quantity: number | null;
  price: number;
  rpc: string | null;
}

export interface ItemPayload {
  category: string | null;
  name: string;
  information: string;
  image: string | null;
  isDisabled: boolean;
  icon: string | null;
  classification: string | null;
  quantity: number | null;
  price: number;
  rpc: string | null;
}

class SupabaseItemRepository {
  async fetchShopItems(): Promise<ShopItem[]> {
    const { data, error } = await supabase.from("items").select("id,category,classification,name,information,image,icon,quantity,price,rpc").eq("isDisabled", false).order("classification").order("name");
    if (error) throw new Error(error.message);
    return data.map((item) => ({ ...item, price: Number(item.price), quantity: item.quantity == null ? null : Number(item.quantity), rpc: item.rpc }));
  }

  async fetchAll(): Promise<AdminItemRow[]> {
    const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return data.map((item) => ({
      id: item.id,
      createdAt: item.created_at,
      category: item.category,
      name: item.name,
      information: item.information,
      image: item.image,
      updatedAt: item.updated_at,
      isDisabled: item.isDisabled,
      icon: item.icon,
      classification: item.classification,
      quantity: item.quantity == null ? null : Number(item.quantity),
      price: Number(item.price),
      rpc: item.rpc,
    }));
  }

  async create(payload: ItemPayload): Promise<void> {
    const { error } = await supabase.from("items").insert(payload);
    if (error) throw new Error(error.message);
  }

  async update(id: string, payload: ItemPayload): Promise<void> {
    const { error } = await supabase
      .from("items")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async getReward(): Promise<ItemRow[]> {
    const { data, error } = await supabase.from("items").select("*").eq("isDisabled", false).order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
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
