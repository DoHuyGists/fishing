import supabase from "../database/connection";

export interface GuideRow {
  id: string;
  title: string;
  content: string;
  sort_order: number;
}

class SupabaseGuideRepository {
  async fetchAll(): Promise<GuideRow[]> {
    const { data, error } = await supabase
      .from("guides")
      .select("id, title, content, sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as GuideRow[];
  }
}

export const supabaseGuideRepository = new SupabaseGuideRepository();
