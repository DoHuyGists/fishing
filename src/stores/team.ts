import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import type { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "../database/connection";
import {
  supabaseTeamRepository,
  type UserTeam,
  type UserTeamMember,
  type TeamStatus,
  type TeamJoinType,
  type UserTeamInvite,
} from "../data/supabaseTeamRepository";

// Module-level: không đưa vào Pinia state để tránh serialize warning
let _channel: RealtimeChannel | null = null;

export const useTeamStore = defineStore("team", {
  state: () => ({
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
  }),

  getters: {
    isInTeam: (state) => state.myTeam !== null,
    isLeader: (state) => (userId: string) =>
      state.myTeam?.leader_id === userId,
    memberCount: (state) => state.myTeamMembers.length,
  },

  actions: {
    async loadData(userId: string) {
      this.loading = true;
      this.error = "";
      try {
        const [teams, myTeamData, myInvites] = await Promise.all([
          supabaseTeamRepository.fetchTeams(),
          supabaseTeamRepository.fetchMyTeam(userId),
          supabaseTeamRepository.fetchMyInvites(userId),
        ]);
        this.teams = teams;
        this.myInvites = myInvites;
        this.myTeam = myTeamData?.team ?? null;
        this.myTeamMembers = myTeamData?.members ?? [];
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('team.khong_the_tai_du_lieu_nhom');
      } finally {
        this.loading = false;
      }
    },

    /**
     * Đăng ký lắng nghe realtime trên user_teams và user_team_members.
     * Gọi một lần sau khi loadData; cleanup bằng unsubscribeRealtime().
     */
    subscribeRealtime(userId: string) {
      if (_channel) return; // đã subscribe rồi

      _channel = supabase
        .channel("team-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_teams" },
          () => { this.loadData(userId); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_team_members" },
          () => { this.loadData(userId); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_team_invite" },
          () => { this.loadData(userId); }
        )
        .subscribe();
    },

    unsubscribeRealtime() {
      if (_channel) {
        supabase.removeChannel(_channel);
        _channel = null;
      }
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
