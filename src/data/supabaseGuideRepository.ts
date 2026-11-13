import { readCatalogPages } from './readCatalogPages';
import { RepositoryError } from './repositoryError';
import type { GuideRow, AdminGuideRow, GuidePayload } from "../types/table/guide";
import { t as tr } from "../i18n";
import supabase from "../database/connection";

const adminColumns = "id, title, content, sort_order, is_published, created_at";

class SupabaseGuideRepository {
  async fetchAll(signal?: AbortSignal): Promise<GuideRow[]> {
    const data = await readCatalogPages((from, to) => supabase
      .from("guides")
      .select("id, title, content, sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }).abortSignal(signal ?? new AbortController().signal).range(from, to));
    return (data ?? []) as GuideRow[];
  }

  async fetchAdminGuides(): Promise<AdminGuideRow[]> {
    const { data, error } = await supabase
      .from("guides")
      .select(adminColumns)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw new RepositoryError(error);
    return (data ?? []) as AdminGuideRow[];
  }

  async create(payload: GuidePayload): Promise<AdminGuideRow> {
    const { data, error } = await supabase.from("guides").insert(payload).select(adminColumns).single();
    if (error) throw new RepositoryError(error);
    return data as AdminGuideRow;
  }

  async update(id: string, payload: GuidePayload): Promise<AdminGuideRow> {
    const { data, error } = await supabase.from("guides").update(payload).eq("id", id).select(adminColumns).single();
    if (error) throw new RepositoryError(error);
    return data as AdminGuideRow;
  }

  async remove(id: string): Promise<void> {
    const { data, error } = await supabase.from("guides").delete().eq("id", id).select("id").single();
    if (error) throw new RepositoryError(error);
    if (!data) throw new Error(tr('supabaseGuideRepository.huong_dan_khong_con_ton_tai_hoac_ban_khong_co_quyen_xoa'));
  }
}

export const supabaseGuideRepository = new SupabaseGuideRepository();
