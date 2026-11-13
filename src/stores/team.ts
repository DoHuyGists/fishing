import type { UserTeam, UserTeamMember, TeamStatus, TeamJoinType, UserTeamInvite } from "../types/model/team";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { useAuthStore } from './auth';
import { useReadCacheStore } from './readCache';
import { createKeyedRefreshTask } from '../utils/refreshTask';
import { startVisibleRefresh } from '../utils/visibleRefresh';
import { supabaseTeamRepository } from "../data/supabaseTeamRepository";

const refreshMembership = createKeyedRefreshTask<void>();
const refreshDirectory = createKeyedRefreshTask<void>();
const consumers = new Map<string, string>();
let stopRefresh: (() => void) | null = null;

export const useTeamStore = defineStore("team", {
  state: () => ({
    ownerId: '',
    /** Danh sách tất cả nhóm đang active (OPEN/FULL/FISHING) */
    teams: [] as UserTeam[],
    /** Nhóm mà user hiện đang tham gia (null nếu chưa join) */
    myTeam: null as UserTeam | null,
    /** Thành viên của myTeam */
    myTeamMembers: [] as UserTeamMember[],
    /** Lời mời vào tổ đội đang chờ của user */
    myInvites: [] as UserTeamInvite[],
    loading: false,
    actionLoading: false,
    error: "",
    membershipError: '',
    directoryError: '',
  }),

  getters: {
    isInTeam: (state) => state.myTeam !== null,
    isLeader: (state) => (userId: string) =>
      state.myTeam?.leader_id === userId,
    memberCount: (state) => state.myTeamMembers.length,
  },

  actions: {
    async loadMyTeam(userId: string, invalidate = false) {
      const auth = useAuthStore();
      if (auth.user?.id !== userId) return;
      const generation = auth.sessionGeneration;
      return refreshMembership(userId + ':' + generation, async () => {
        try {
          if (invalidate) { await useReadCacheStore().invalidate(['team', 'profile']); if (auth.user?.id !== userId || auth.sessionGeneration !== generation) return; }
          const [myTeamData, invites] = await Promise.all([
            supabaseTeamRepository.fetchMyTeam(userId), supabaseTeamRepository.fetchMyInvites(userId),
          ]);
          if (auth.user?.id !== userId || auth.sessionGeneration !== generation) return;
          this.myTeam = myTeamData?.team ?? null;
          this.myTeamMembers = myTeamData?.members ?? [];
          this.myInvites = invites;
          this.membershipError = ''; this.error = this.directoryError;
        } catch (err) {
          if (auth.user?.id === userId && auth.sessionGeneration === generation) {
            this.membershipError = err instanceof Error ? err.message : tr('team.khong_the_tai_du_lieu_nhom');
            this.error = this.membershipError;
          }
        }
      }, invalidate);
    },
    async loadTeams(userId: string, invalidate = false) {
      const auth = useAuthStore();
      if (auth.user?.id !== userId) return;
      const generation = auth.sessionGeneration;
      return refreshDirectory(userId + ':' + generation, async () => {
        try {
          if (invalidate) { await useReadCacheStore().invalidate(['team']); if (auth.user?.id !== userId || auth.sessionGeneration !== generation) return; }
          const teams = await supabaseTeamRepository.fetchTeams();
          if (auth.user?.id === userId && auth.sessionGeneration === generation) {
            this.teams = teams; this.directoryError = ''; this.error = this.membershipError;
          }
        } catch (err) {
          if (auth.user?.id === userId && auth.sessionGeneration === generation) {
            this.directoryError = err instanceof Error ? err.message : tr('team.khong_the_tai_du_lieu_nhom');
            this.error = this.directoryError;
          }
        }
      }, invalidate);
    },
    async loadData(userId: string, invalidate = true) {
      const auth = useAuthStore();
      if (auth.user?.id !== userId) return;
      const generation = auth.sessionGeneration;
      this.loading = true;
      try { await Promise.all([this.loadMyTeam(userId, invalidate), this.loadTeams(userId, invalidate)]); }
      finally { if (auth.user?.id === userId && auth.sessionGeneration === generation) this.loading = false; }
    },
    startRefreshing(userId: string, consumer: 'lobby' | 'panel') {
      if (this.ownerId !== userId) {
        stopRefresh?.(); stopRefresh = null; consumers.clear();
        this.$reset(); this.ownerId = userId;
      }
      if (consumers.get(consumer) === userId && stopRefresh) return;
      const alreadyRefreshing = Boolean(stopRefresh);
      consumers.set(consumer, userId);
      // The panel explicitly loads its data on mount. Changing polling speed
      // must not start another immediate read alongside that load.
      this.restartRefresh(userId, !alreadyRefreshing);
    },
    stopRefreshing(consumer: 'lobby' | 'panel') {
      consumers.delete(consumer);
      stopRefresh?.(); stopRefresh = null;
      const owner = consumers.values().next().value;
      if (owner) this.restartRefresh(owner, false);
    },
    restartRefresh(userId: string, immediate = true) {
      stopRefresh?.();
      let lastDirectoryAt = 0;
      stopRefresh = startVisibleRefresh(async () => {
        if (useAuthStore().user?.id !== userId) return;
        const jobs = [this.loadMyTeam(userId)];
        if (consumers.has('panel') && Date.now() - lastDirectoryAt >= 30_000) {
          lastDirectoryAt = Date.now(); jobs.push(this.loadTeams(userId));
        }
        await Promise.all(jobs);
        if (this.error) throw new Error(this.error);
      }, consumers.has('panel') ? 15_000 : 30_000, immediate);
    },

    async createTeam(
      userId: string,
      name: string,
      description: string | null,
      maxMembers: number,
      status: TeamStatus,
      joinType: TeamJoinType
    ): Promise<boolean> {
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseTeamRepository.createTeam(name, description, maxMembers, status, joinType);
        await this.loadData(userId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('supabaseTeamRepository.khong_the_tao_nhom');
        return false;
      } finally {
        this.actionLoading = false;
      }
    },

    async updateTeam(userId: string, updates: Pick<UserTeam, "name" | "description" | "max_members" | "status" | "join_type">): Promise<boolean> {
      if (!this.myTeam || this.myTeam.leader_id !== userId) return false;
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseTeamRepository.updateTeam(this.myTeam.id, updates);
        await this.loadData(userId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('supabaseTeamRepository.khong_the_cap_nhat_nhom');
        return false;
      } finally {
        this.actionLoading = false;
      }
    },

    async joinTeam(userId: string, teamId: string): Promise<boolean> {
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseTeamRepository.joinTeam(teamId);
        await this.loadData(userId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('supabaseTeamRepository.khong_the_tham_gia_nhom');
        return false;
      } finally {
        this.actionLoading = false;
      }
    },

    async leaveTeam(userId: string): Promise<boolean> {
      if (!this.myTeam) return false;
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseTeamRepository.leaveTeam(this.myTeam.id);
        await this.loadData(userId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('supabaseTeamRepository.khong_the_roi_nhom');
        return false;
      } finally {
        this.actionLoading = false;
      }
    },

    async kickMember(userId: string, memberId: string): Promise<boolean> {
      if (!this.myTeam) return false;
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseTeamRepository.kickMember(this.myTeam.id, memberId);
        await this.loadData(userId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('supabaseTeamRepository.khong_the_kick_thanh_vien');
        return false;
      } finally {
        this.actionLoading = false;
      }
    },

    async closeTeam(userId: string): Promise<boolean> {
      if (!this.myTeam) return false;
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseTeamRepository.closeTeam(this.myTeam.id);
        await this.loadData(userId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('supabaseTeamRepository.khong_the_dong_nhom');
        return false;
      } finally {
        this.actionLoading = false;
      }
    },

    async closeAndLeaveTeam(userId: string): Promise<boolean> {
      if (!this.myTeam) return false;
      this.actionLoading = true;
      this.error = "";
      try {
        const teamId = this.myTeam.id;
        await supabaseTeamRepository.closeTeam(teamId);
        await supabaseTeamRepository.leaveTeam(teamId);
        await this.loadData(userId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('team.khong_the_roi_va_dong_nhom');
        return false;
      } finally {
        this.actionLoading = false;
      }
    },

    async inviteUser(userId: string, inviteeId: string): Promise<boolean> {
      if (!this.myTeam || this.myTeam.leader_id !== userId) return false;
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseTeamRepository.inviteUser(this.myTeam.id, userId, inviteeId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('supabaseTeamRepository.khong_the_gui_loi_moi');
        return false;
      } finally {
        this.actionLoading = false;
      }
    },

    async respondInvite(userId: string, inviteId: string, accept: boolean): Promise<boolean> {
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseTeamRepository.respondInvite(inviteId, accept);
        await this.loadData(userId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('supabaseTeamRepository.khong_the_xu_ly_loi_moi');
        return false;
      } finally {
        this.actionLoading = false;
      }
    },

    async transferLeadership(userId: string, newLeaderId: string): Promise<boolean> {
      if (!this.myTeam) return false;
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseTeamRepository.transferLeadership(this.myTeam.id, newLeaderId);
        await this.loadData(userId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('supabaseTeamRepository.khong_the_chuyen_quyen_truong_nhom');
        return false;
      } finally {
        this.actionLoading = false;
      }
    },
  },
});
