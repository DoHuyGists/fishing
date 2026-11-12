import type { UserProfile } from "./userProfile";

// ─── Views ───────────────────────────────────────────────────────────────────
// 'list'  → danh sách nhóm
// 'create'→ form tạo nhóm
// 'room'  → phòng nhóm đang tham gia
export type TeamView = "list" | "create" | "edit" | "room";

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
  user_profile: Pick<UserProfile, "id" | "level" | "experience_point" | "display_name" | "avatar_url" | "avatar_path" | "country_id"> | null;
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
