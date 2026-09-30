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
}

export interface ItemPayload {
  category: string | null;
  name: string;
  information: string;
  image: string | null;
  isDisabled: boolean;
  icon: string | null;
}

class SupabaseItemRepository {
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
