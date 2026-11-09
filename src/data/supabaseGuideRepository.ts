import supabase from "../database/connection";

export interface GuideRow {
  id: string;
  title: string;
  content: string;
  sort_order: number;
}

export interface AdminGuideRow extends GuideRow {
  is_published: boolean;
  created_at: string;
}

export type GuidePayload = Pick<AdminGuideRow, "title" | "content" | "sort_order" | "is_published">;

const adminColumns = "id, title, content, sort_order, is_published, created_at";

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

  async fetchAdminGuides(): Promise<AdminGuideRow[]> {
    const { data, error } = await supabase
      .from("guides")
      .select(adminColumns)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as AdminGuideRow[];
  }

  async create(payload: GuidePayload): Promise<AdminGuideRow> {
    const { data, error } = await supabase.from("guides").insert(payload).select(adminColumns).single();
    if (error) throw new Error(error.message);
    return data as AdminGuideRow;
  }

  async update(id: string, payload: GuidePayload): Promise<AdminGuideRow> {
    const { data, error } = await supabase.from("guides").update(payload).eq("id", id).select(adminColumns).single();
    if (error) throw new Error(error.message);
    return data as AdminGuideRow;
  }

  async remove(id: string): Promise<void> {
    const { data, error } = await supabase.from("guides").delete().eq("id", id).select("id").single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Hướng dẫn không còn tồn tại hoặc bạn không có quyền xóa.");
  }
}

export const supabaseGuideRepository = new SupabaseGuideRepository();
