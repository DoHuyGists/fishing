import { defineStore } from "pinia";
import type { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "../database/connection";
import {
  supabaseTeamRepository,
  type UserTeam,
  type UserTeamMember,
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
        const [teams, myTeamData] = await Promise.all([
          supabaseTeamRepository.fetchTeams(),
          supabaseTeamRepository.fetchMyTeam(userId),
        ]);
        this.teams = teams;
        this.myTeam = myTeamData?.team ?? null;
        this.myTeamMembers = myTeamData?.members ?? [];
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể tải dữ liệu nhóm";
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
      maxMembers: number
    ): Promise<boolean> {
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseTeamRepository.createTeam(name, description, maxMembers);
        await this.loadData(userId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể tạo nhóm";
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
        this.error = err instanceof Error ? err.message : "Không thể tham gia nhóm";
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
        this.error = err instanceof Error ? err.message : "Không thể rời nhóm";
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
        this.error = err instanceof Error ? err.message : "Không thể kick thành viên";
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
        this.error = err instanceof Error ? err.message : "Không thể đóng nhóm";
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
        this.error = err instanceof Error ? err.message : "Không thể chuyển quyền trưởng nhóm";
        return false;
      } finally {
        this.actionLoading = false;
      }
    },
  },
});
