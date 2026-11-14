import supabase from '../database/connection';
import { RepositoryError } from './repositoryError';
import type { DispatchRequest, DispatchState } from '../types/model/dispatch';
import type { DispatchHistory } from '../types/table/dispatch';

class SupabaseDispatchRepository {
  async fetchState(): Promise<DispatchState> {
    const { data, error } = await supabase.rpc('get_dispatch_state');
    if (error) throw new RepositoryError(error);
    return data as DispatchState;
  }
  async fetchHistory(page: number, pageSize: number) {
    const { data, error, count } = await supabase.from('dispatch_history').select('*', { count: 'exact' })
      .order('resolved_at', { ascending: false }).order('id', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new RepositoryError(error);
    return { items: (data ?? []) as DispatchHistory[], total: count ?? 0 };
  }
  async execute(request: DispatchRequest): Promise<void> {
    const { error, status } = await supabase.rpc('dispatch_action', {
      p_request_id: request.requestId, p_kind: request.kind, p_target_id: request.targetId, p_job_id: request.jobId,
      p_npc_version: request.npcVersion, p_job_version: request.jobVersion,
    });
    if (error) throw new RepositoryError({ ...error, status });
  }
}
export const supabaseDispatchRepository = new SupabaseDispatchRepository();
