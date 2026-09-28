import supabase from "../database/connection";

export interface ItemRow {
  id: string
  createdAt: string
  category: string
  name: string
  information: string
  image: string
  updatedAt: string
  isDisabled: boolean
}

class SupabaseItemRepository {
  async getReward() : Promise<ItemRow[]> {
    const { data, error } = await supabase.from("items").select("*").eq("isDisabled", false).order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data.map(x => ({
        id: x.id,
        createdAt: x.created_at,
        category: x.category,
        name: x.name,
        information: x.information,
        image: x.image,
        updatedAt: x.updated_at,
        isDisabled: x.isDisabled,
      }))
  }
}


export const supabaseItemRepository = new SupabaseItemRepository();
