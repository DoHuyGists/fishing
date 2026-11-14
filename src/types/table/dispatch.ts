export interface DispatchText { vi: string; en: string }
export type DispatchCatalogKind = 'npcs' | 'jobs';
export type DispatchStats = Record<string, number>;
export interface DispatchRewards { cash?: number; shells?: number; tickets?: number }

export interface DispatchCatalogRow {
  id: string;
  code: string;
  name: DispatchText;
  description: Partial<DispatchText>;
  image_path: string;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
export interface DispatchNpc extends DispatchCatalogRow {
  purchase_shells: number;
  operating_cash: number;
  data: { stats?: DispatchStats; [key: string]: unknown };
}
export interface DispatchJob extends DispatchCatalogRow {
  duration_seconds: number;
  data: { requirements?: DispatchStats; [key: string]: unknown };
  rewards: DispatchRewards;
}
export interface DispatchOwnedNpc {
  id: string;
  user_id: string;
  npc_id: string;
  purchased_shells: number;
  acquired_at: string;
}
export interface DispatchRun {
  id: string;
  user_id: string;
  owned_npc_id: string;
  job_id: string;
  status: 'running' | 'claimed' | 'cancelled';
  started_at: string;
  ends_at: string;
  resolved_at: string | null;
  operating_cash: number;
  npc_snapshot: DispatchNpc;
  job_snapshot: DispatchJob;
  rewards: DispatchRewards;
}
export interface DispatchHistory extends Omit<DispatchRun, 'owned_npc_id' | 'job_id' | 'status' | 'resolved_at'> {
  run_id: string;
  outcome: 'claimed' | 'cancelled';
  resolved_at: string;
}
