import supabase from "../database/connection";

export type TeamStatus = "OPEN" | "FULL" | "FISHING" | "CLOSED";
export type TeamMemberRole = "LEADER" | "MEMBER";

export interface UserTeam {
  id: string;
  name: string;
  description: string | null;
  leader_id: string;
  max_members: number;
  status: TeamStatus;
  created_at: string;
  updated_at: string;
}

export interface UserTeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  joined_at: string;
}

class SupabaseTeamRepository {
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
    return (data ?? []) as UserTeamMember[];
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

  async createTeam(name: string, description: string | null, maxMembers: number): Promise<void> {
    const { error } = await supabase.rpc("create_team", {
      p_name: name,
      p_description: description,
      p_max_members: maxMembers,
    });
    if (error) throw new Error(error.message || "Không thể tạo nhóm");
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
