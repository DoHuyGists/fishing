import { i18n } from '../i18n';
import type { DispatchJob, DispatchNpc, DispatchRun, DispatchText } from '../types/table/dispatch';

export function dispatchText(text: Partial<DispatchText>): string {
  return text[i18n.global.locale.value as keyof DispatchText] || text.vi || text.en || '';
}
export function dispatchEligible(npc: DispatchNpc, job: DispatchJob): boolean {
  return npc.enabled && job.enabled && Object.entries(job.data.requirements ?? {})
    .every(([key, minimum]) => (npc.data.stats?.[key] ?? 0) >= minimum);
}
export function dispatchProgress(run: DispatchRun, now: number): number {
  const start = Date.parse(run.started_at), end = Date.parse(run.ends_at);
  return Math.max(0, Math.min(100, (now - start) / (end - start) * 100));
}
