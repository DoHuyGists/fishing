import { defineStore } from 'pinia';
import { t as tr } from '../i18n';
import { dispatchEligible } from '../data/dispatch';
import { supabaseDispatchRepository as repository } from '../data/supabaseDispatchRepository';
import { RepositoryError } from '../data/repositoryError';
import { createUuid } from '../utils/uuid';
import { useAuthStore } from './auth';
import { useToast } from '../composables/useToast';
import type { DispatchConfirmation, DispatchRequest, DispatchState } from '../types/model/dispatch';
import type { DispatchHistory, DispatchJob, DispatchNpc, DispatchOwnedNpc, DispatchRun } from '../types/table/dispatch';

const kinds = ['buy', 'start', 'claim', 'repeat', 'cancel'];
function savePending(owner: string, request: DispatchRequest | null) {
  try {
    if (request) sessionStorage.setItem('dispatch-pending:' + owner, JSON.stringify(request));
    else sessionStorage.removeItem('dispatch-pending:' + owner);
  } catch { /* In-memory retries still use the same receipt. */ }
}
function restorePending(owner: string): DispatchRequest | null {
  try {
    const request = JSON.parse(sessionStorage.getItem('dispatch-pending:' + owner) ?? 'null');
    return request && kinds.includes(request.kind) && typeof request.requestId === 'string'
      && typeof request.targetId === 'string' && (request.jobId === null || typeof request.jobId === 'string')
      && (request.npcVersion === null || typeof request.npcVersion === 'string')
      && (request.jobVersion === null || typeof request.jobVersion === 'string') ? request : null;
  } catch { return null; }
}
function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    DISPATCH_AUTH: tr('Dispatch.errorAuth'), DISPATCH_DISABLED: tr('Dispatch.errorDisabled'),
    DISPATCH_INVALID: tr('Dispatch.errorInvalid'), DISPATCH_WALLET: tr('Dispatch.errorWallet'),
    DISPATCH_NPC_UNAVAILABLE: tr('Dispatch.errorNpc'), DISPATCH_JOB_UNAVAILABLE: tr('Dispatch.errorJob'),
    DISPATCH_NPC_BUSY: tr('Dispatch.errorBusy'), DISPATCH_REQUIREMENTS: tr('Dispatch.errorRequirements'),
    DISPATCH_OWNED: tr('Dispatch.errorOwned'), DISPATCH_SHELLS: tr('Dispatch.errorShells'),
    DISPATCH_CASH: tr('Dispatch.errorCash'), DISPATCH_NOT_READY: tr('Dispatch.errorNotReady'),
    DISPATCH_RUN_UNAVAILABLE: tr('Dispatch.errorRun'),
    DISPATCH_CATALOG_CHANGED: tr('Dispatch.errorCatalogChanged'),
  };
  return messages[code] || tr('Dispatch.errorGeneric');
}

export const useDispatchStore = defineStore('DispatchPlayer', {
  state: () => ({
    ownerId: '', snapshot: null as DispatchState | null,
    tab: 'npcs', selectedNpcId: '', selectedJobId: '',
    confirmation: null as DispatchConfirmation | null,
    pending: null as DispatchRequest | null,
    history: [] as DispatchHistory[], historyPage: 1, historyTotal: 0, historyPageSize: 10,
    loading: false, historyLoading: false, busy: false, needsRefresh: false,
    error: '', historyError: '', now: Date.now(), clockBase: 0, clockAnchor: 0,
    readSequence: 0, historySequence: 0, epoch: 0,
  }),
  getters: {
    npcs: (s): DispatchNpc[] => s.snapshot?.npcs ?? [],
    jobs: (s): DispatchJob[] => s.snapshot?.jobs ?? [],
    owned: (s): DispatchOwnedNpc[] => s.snapshot?.owned ?? [],
    runs: (s): DispatchRun[] => s.snapshot?.runs ?? [],
    selectedNpc(): DispatchNpc | null { return this.npcs.find(n => n.id === this.selectedNpcId) ?? null; },
    selectedJob(): DispatchJob | null { return this.jobs.find(j => j.id === this.selectedJobId) ?? null; },
    selectedOwned(): DispatchOwnedNpc | null { return this.owned.find(o => o.npc_id === this.selectedNpcId) ?? null; },
    canAssign(): boolean {
      return Boolean(this.selectedNpc && this.selectedJob && this.selectedOwned
        && !this.runs.some(r => r.owned_npc_id === this.selectedOwned?.id)
        && dispatchEligible(this.selectedNpc, this.selectedJob));
    },
    locked: s => s.busy || s.loading || s.needsRefresh || Boolean(s.pending),
    confirmationCost(): number {
      const c = this.confirmation;
      if (!c) return 0;
      if (c.kind === 'buy') return this.npcs.find(n => n.id === c.targetId)?.purchase_shells ?? 0;
      const ownedId = c.kind === 'repeat' ? this.runs.find(r => r.id === c.targetId)?.owned_npc_id : c.targetId;
      const npcId = this.owned.find(o => o.id === ownedId)?.npc_id;
      return this.npcs.find(n => n.id === npcId)?.operating_cash ?? 0;
    },
    repeatCashReward(): number {
      return this.confirmation?.kind === 'repeat'
        ? this.runs.find(r => r.id === this.confirmation?.targetId)?.rewards.cash ?? 0 : 0;
    },
  },
  actions: {
    resetSession() { const epoch = this.epoch + 1; this.$reset(); this.epoch = epoch; },
    async initialize(owner: string) {
      this.resetSession();
      this.ownerId = owner;
      this.pending = restorePending(owner);
      if (owner) await this.refresh();
    },
    updateClock() {
      if (this.clockBase) this.now = this.clockBase + performance.now() - this.clockAnchor;
    },
    async refresh(): Promise<boolean> {
      const auth = useAuthStore(), owner = this.ownerId, generation = auth.sessionGeneration, epoch = this.epoch;
      if (!owner || auth.user?.id !== owner) return false;
      const sequence = ++this.readSequence;
      const current = () => auth.user?.id === owner && auth.sessionGeneration === generation && epoch === this.epoch && sequence === this.readSequence;
      this.loading = true;
      this.error = '';
      try {
        const state = await repository.fetchState();
        if (!current()) return false;
        this.snapshot = state;
        this.clockBase = Date.parse(state.server_time);
        this.clockAnchor = performance.now();
        this.updateClock();
        this.needsRefresh = false;
        return true;
      } catch (error) {
        if (current()) { this.error = errorMessage(error); this.needsRefresh = true; }
        return false;
      } finally { if (current()) this.loading = false; }
    },
    async fetchHistory(page = 1) {
      const auth = useAuthStore(), owner = this.ownerId, generation = auth.sessionGeneration, epoch = this.epoch;
      if (!owner || auth.user?.id !== owner) return;
      const sequence = ++this.historySequence;
      const current = () => auth.user?.id === owner && auth.sessionGeneration === generation && epoch === this.epoch && sequence === this.historySequence;
      this.historyLoading = true; this.historyError = '';
      try {
        const result = await repository.fetchHistory(page, this.historyPageSize);
        if (!current()) return;
        this.history = result.items; this.historyTotal = result.total; this.historyPage = page;
      } catch (error) { if (current()) this.historyError = errorMessage(error); }
      finally { if (current()) this.historyLoading = false; }
    },
    selectNpc(id: string) { this.selectedNpcId = id; this.tab = 'jobs'; },
    selectJob(id: string) { this.selectedJobId = id; this.tab = 'npcs'; },
    ask(kind: DispatchConfirmation['kind'], targetId: string, jobId: string | null = null) {
      if (!this.locked) this.confirmation = { kind, targetId, jobId };
    },
    async confirm() {
      if (!this.confirmation || this.locked) return;
      const c = this.confirmation;
      const run = c.kind === 'repeat' ? this.runs.find(r => r.id === c.targetId) : null;
      const owned = this.owned.find(o => o.id === (run?.owned_npc_id ?? c.targetId));
      const npc = this.npcs.find(n => n.id === (c.kind === 'buy' ? c.targetId : owned?.npc_id));
      const job = this.jobs.find(j => j.id === (run?.job_id ?? c.jobId));
      const request = { ...c, requestId: createUuid(), npcVersion: npc?.updated_at ?? null, jobVersion: job?.updated_at ?? null };
      await this.perform(request);
    },
    async retryPending() { if (this.pending && !this.busy) await this.perform(this.pending); },
    async perform(request: DispatchRequest) {
      const auth = useAuthStore(), owner = this.ownerId, generation = auth.sessionGeneration, epoch = this.epoch;
      if (this.busy || !owner || auth.user?.id !== owner) return;
      const current = () => auth.user?.id === owner && auth.sessionGeneration === generation && epoch === this.epoch;
      this.busy = true; this.error = ''; this.pending = request;
      savePending(owner, request);
      const oldRun = this.runs.find(r => r.id === request.targetId);
      const npcId = request.kind === 'buy' ? request.targetId : this.owned.find(o => o.id === (oldRun?.owned_npc_id ?? request.targetId))?.npc_id;
      try {
        await repository.execute(request);
        if (!current()) return;
        this.pending = null; savePending(owner, null); this.confirmation = null;
        this.needsRefresh = true;
        if (request.kind === 'buy' || request.kind === 'claim') {
          this.selectedNpcId = npcId ?? ''; this.selectedJobId = ''; this.tab = 'jobs';
        } else if (request.kind === 'start' || request.kind === 'repeat') this.tab = 'runs';
        useToast().success(tr('Dispatch.actionSuccess'));
        const refreshed = await this.refresh();
        if (!current()) return;
        if (!refreshed) this.error = tr('Dispatch.refreshAfterSuccess');
        if (this.tab === 'history') await this.fetchHistory();
      } catch (error) {
        if (!current()) return;
        const uncertain = !(error instanceof RepositoryError) || !error.code
          || /^PGRST00[012]$/.test(error.code) || error.status === 0 || (error.status ?? 0) >= 500;
        if (uncertain) {
          this.error = tr('Dispatch.uncertain');
          this.confirmation = null;
        } else {
          this.pending = null; savePending(owner, null);
          this.confirmation = null;
          await this.refresh();
          if (current()) this.error = errorMessage(error);
        }
      } finally { if (current()) this.busy = false; }
    },
  },
});
