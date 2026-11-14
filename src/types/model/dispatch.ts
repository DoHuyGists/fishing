import type { DispatchJob, DispatchNpc, DispatchOwnedNpc, DispatchRun } from '../table/dispatch';

export type DispatchActionKind = 'buy' | 'start' | 'claim' | 'repeat' | 'cancel';
export interface DispatchRequest {
  requestId: string;
  kind: DispatchActionKind;
  targetId: string;
  jobId: string | null;
  npcVersion: string | null;
  jobVersion: string | null;
}
export interface DispatchState {
  server_time: string;
  npcs: DispatchNpc[];
  jobs: DispatchJob[];
  owned: DispatchOwnedNpc[];
  runs: DispatchRun[];
}
export interface DispatchConfirmation { kind: DispatchActionKind; targetId: string; jobId: string | null }
