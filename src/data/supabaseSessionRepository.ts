import supabase from '../database/connection';
import { RepositoryError } from './repositoryError';
import type { ActiveSession } from '../types/table/activeSession';

export const supabaseSessionRepository = {
  async claim(userId: string, sessionId: string, signal: AbortSignal) {
    const { error } = await supabase.from('active_sessions').upsert({
      user_id: userId, active_session_id: sessionId, updated_at: new Date().toISOString(),
    } satisfies ActiveSession, { onConflict: 'user_id' }).abortSignal(signal);
    if (error) throw new RepositoryError(error);
  },
  async fetchOwner(userId: string, signal: AbortSignal): Promise<string | null> {
    const { data, error } = await supabase.from('active_sessions')
      .select('active_session_id').eq('user_id', userId).abortSignal(signal).maybeSingle();
    if (error) throw new RepositoryError(error);
    return data?.active_session_id ?? null;
  },
  listen(userId: string, onChange: () => void, onConnection: (connected: boolean) => void) {
    let stopped = false;
    let settle: (ready: boolean) => void;
    let rejectReady: (error: Error) => void;
    const ready = new Promise<boolean>((resolve, reject) => { settle = resolve; rejectReady = reject; });
    const timeout = setTimeout(() => rejectReady(new Error('Session subscription timed out')), 10_000);
    const channel = supabase.channel(`user-session:${userId}`)
      .on<ActiveSession>('postgres_changes', {
        event: '*', schema: 'public', table: 'active_sessions', filter: `user_id=eq.${userId}`,
      }, () => { if (!stopped) onChange(); })
      .subscribe(status => {
        if (stopped) return;
        const connected = status === 'SUBSCRIBED';
        onConnection(connected);
        if (connected) { clearTimeout(timeout); settle(true); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeout);
          rejectReady(new Error(`Session subscription: ${status}`));
        }
      });
    return { ready, stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timeout);
      settle(false);
      void supabase.removeChannel(channel).catch(error => console.error('[Session cleanup]', error));
    } };
  },
};
