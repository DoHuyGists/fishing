import supabase from "../database/connection";
import type { UserProfile } from "./supabaseUserProfileRepository";

export type TeamStatus = "PENDING" | "OPEN" | "FULL" | "FISHING" | "CLOSED";
export type TeamJoinType = "everyone" | "friend" | "invited";
export type TeamMemberRole = "LEADER" | "MEMBER";

export interface UserTeam {
  id: string;
  name: string;
  description: string | null;
  leader_id: string;
  max_members: number;
  status: TeamStatus;
  join_type: TeamJoinType;
  created_at: string;
  updated_at: string;
}

export interface UserTeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  joined_at: string;
  user_profile: Pick<UserProfile, "id" | "level" | "experience_point"> | null;
}

export type TeamInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface UserTeamInvite {
  id: string;
  team_id: string;
  inviter_id: string;
  invitee_id: string;
  status: TeamInviteStatus;
  created_at: string;
  team: Pick<UserTeam, "id" | "name" | "description" | "max_members" | "status"> | null;
}

class SupabaseTeamRepository {
  /** Trưởng nhóm mời người chơi theo id */
  async inviteUser(teamId: string, inviterId: string, inviteeId: string): Promise<void> {
    const { data: profile, error: profileError } = await supabase
      .from("user_profile")
      .select("id")
      .eq("id", inviteeId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message || "Không thể kiểm tra người chơi");
    if (!profile) throw new Error("Không tìm thấy người chơi với ID này");

    const { error } = await supabase
      .from("user_team_invite")
      .insert({ team_id: teamId, inviter_id: inviterId, invitee_id: inviteeId });
    if (error) {
      if (error.code === "23505") throw new Error("Người chơi này đã được mời vào tổ đội");
      throw new Error(error.message || "Không thể gửi lời mời");
    }
  }

  /** Lời mời đang chờ gửi đến người chơi */
  async fetchMyInvites(userId: string): Promise<UserTeamInvite[]> {
    const { data, error } = await supabase
      .from("user_team_invite")
      .select("*")
      .eq("invitee_id", userId)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message || "Không thể tải lời mời");
    const invites = data ?? [];
    if (invites.length === 0) return [];

    const { data: teams, error: teamError } = await supabase
      .from("user_teams")
      .select("id, name, description, max_members, status")
      .in("id", [...new Set(invites.map((invite) => invite.team_id))]);
    if (teamError) throw new Error(teamError.message || "Không thể tải thông tin tổ đội");
    const teamById = new Map((teams ?? []).map((team) => [team.id, team]));

    return invites.map((invite) => ({ ...invite, team: teamById.get(invite.team_id) ?? null })) as UserTeamInvite[];
  }

  async respondInvite(inviteId: string, accept: boolean): Promise<void> {
    const { error } = await supabase.rpc("respond_team_invite", { p_invite_id: inviteId, p_accept: accept });
    if (error) throw new Error(error.message || "Không thể xử lý lời mời");
  }

  /** Lấy danh sách nhóm theo status (mặc định OPEN + FULL để hiển thị) */
  async fetchTeams(statuses: TeamStatus[] = ["OPEN", "FULL", "FISHING"]): Promise<UserTeam[]> {
    const { data, error } = await supabase
      .from("user_teams")
      .select("*")
      .in("status", statuses)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message || "Không thể tải danh sách nhóm");
    return (data ?? []) as UserTeam[];
  }

  /** Lấy thành viên của một nhóm */
  async fetchTeamMembers(teamId: string): Promise<UserTeamMember[]> {
    const { data, error } = await supabase
      .from("user_team_members")
      .select("*")
      .eq("team_id", teamId)
      .order("joined_at", { ascending: true });

    if (error) throw new Error(error.message || "Không thể tải danh sách thành viên");
    const members = data ?? [];
    if (members.length === 0) return [];

    const { data: profiles, error: profileError } = await supabase
      .from("user_profile")
      .select("id, level, experience_point")
      .in("id", members.map((member) => member.user_id));

    if (profileError) throw new Error(profileError.message || "Không thể tải hồ sơ thành viên");
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    return members.map((member) => ({
      ...member,
      user_profile: profileById.get(member.user_id) ?? null,
    })) as UserTeamMember[];
  }

  /** Lấy nhóm mà user đang tham gia (nếu có) */
  async fetchMyTeam(userId: string): Promise<{ team: UserTeam; members: UserTeamMember[] } | null> {
    const { data: memberRow, error: memberError } = await supabase
      .from("user_team_members")
      .select("team_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError) throw new Error(memberError.message);
    if (!memberRow) return null;

    const { data: team, error: teamError } = await supabase
      .from("user_teams")
      .select("*")
      .eq("id", memberRow.team_id)
      .neq("status", "CLOSED")
      .maybeSingle();

    if (teamError) throw new Error(teamError.message);
    if (!team) return null;

    const members = await this.fetchTeamMembers(team.id);
    return { team: team as UserTeam, members };
  }

  async createTeam(name: string, description: string | null, maxMembers: number, status: TeamStatus, joinType: TeamJoinType): Promise<void> {
    const { error } = await supabase.rpc("create_team", {
      p_name: name,
      p_description: description,
      p_max_members: maxMembers,
    });
    if (error) throw new Error(error.message || "Không thể tạo nhóm");

    const { data: membership, error: membershipError } = await supabase
      .from("user_team_members")
      .select("team_id")
      .eq("role", "LEADER")
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (membershipError) throw new Error(membershipError.message);
    if (!membership) throw new Error("Không tìm thấy nhóm vừa tạo");

    await this.updateTeam(membership.team_id, { status, join_type: joinType });
  }

  async updateTeam(teamId: string, updates: Partial<Pick<UserTeam, "name" | "description" | "max_members" | "status" | "join_type">>): Promise<void> {
    const { error } = await supabase
      .from("user_teams")
      .update(updates)
      .eq("id", teamId);
    if (error) throw new Error(error.message || "Không thể cập nhật nhóm");
  }

  async joinTeam(teamId: string): Promise<void> {
    const { error } = await supabase.rpc("join_team", { p_team_id: teamId });
    if (error) throw new Error(error.message || "Không thể tham gia nhóm");
  }

  async leaveTeam(teamId: string): Promise<void> {
    const { error } = await supabase.rpc("leave_team", { p_team_id: teamId });
    if (error) throw new Error(error.message || "Không thể rời nhóm");
  }

  async kickMember(teamId: string, memberId: string): Promise<void> {
    const { error } = await supabase.rpc("kick_team_member", {
      p_team_id: teamId,
      p_member_id: memberId,
    });
    if (error) throw new Error(error.message || "Không thể kick thành viên");
  }

  async closeTeam(teamId: string): Promise<void> {
    const { error } = await supabase.rpc("close_team", { p_team_id: teamId });
    if (error) throw new Error(error.message || "Không thể đóng nhóm");
  }

  async transferLeadership(teamId: string, newLeaderId: string): Promise<void> {
    const { error } = await supabase.rpc("transfer_team_leadership", {
      p_team_id: teamId,
      p_new_leader_id: newLeaderId,
    });
    if (error) throw new Error(error.message || "Không thể chuyển quyền trưởng nhóm");
  }
}

export const supabaseTeamRepository = new SupabaseTeamRepository();
