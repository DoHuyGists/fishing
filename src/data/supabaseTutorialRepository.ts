import supabase from "../database/connection";

export interface TutorialRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  duration_minutes: number;
  sort_order: number;
}

class SupabaseTutorialRepository {
  async fetchPublished(): Promise<TutorialRow[]> {
    const { data, error } = await supabase
      .from("tutorials")
      .select("id, slug, title, description, thumbnail, duration_minutes, sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as TutorialRow[];
  }
}

export const supabaseTutorialRepository = new SupabaseTutorialRepository();
