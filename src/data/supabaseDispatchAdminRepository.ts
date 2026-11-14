import supabase from '../database/connection';
import { RepositoryError } from './repositoryError';
import type { DispatchCatalogKind, DispatchJob, DispatchNpc } from '../types/table/dispatch';

class SupabaseDispatchAdminRepository {
  async fetchPage(kind: DispatchCatalogKind, page: number, search: string) {
    let query = supabase.from('dispatch_' + kind).select('*', { count: 'exact' });
    if (search.trim()) query = query.ilike('code', '%' + search.trim().replace(/[\\%_]/g, '\\$&') + '%');
    const { data, error, count } = await query.order('sort_order').order('code').range((page - 1) * 10, page * 10 - 1);
    if (error) throw new RepositoryError(error);
    return { items: (data ?? []) as (DispatchNpc | DispatchJob)[], total: count ?? 0 };
  }
  async save(kind: DispatchCatalogKind, payload: Record<string, unknown>, id: string | null) {
    const query = id ? supabase.from('dispatch_' + kind).update(payload).eq('id', id)
      : supabase.from('dispatch_' + kind).insert(payload);
    const { data, error } = await query.select('id').single();
    if (error) throw new RepositoryError(error);
    return data;
  }
  async remove(kind: DispatchCatalogKind, id: string) {
    const { error } = await supabase.from('dispatch_' + kind).delete().eq('id', id).select('id').single();
    if (error) throw new RepositoryError(error);
  }
}
export const supabaseDispatchAdminRepository = new SupabaseDispatchAdminRepository();
