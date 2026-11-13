import supabase from '../database/connection';
import type { AdminListPage } from '../types/model/pagination';

export async function fetchAdminListPage<Row>(table: string, page: number, search = '', filters: Record<string, unknown> = {}): Promise<AdminListPage<Row>> {
  const { data, error } = await supabase.rpc('get_admin_list_page', {
    p_table: table, p_page: page, p_search: search.trim(), p_filters: filters,
  });
  if (error) throw new Error(error.message);
  return data as AdminListPage<Row>;
}
