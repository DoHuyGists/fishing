export type FriendTab = "friends" | "received" | "sent" | "discover";

export type FriendDeleteKind = "friend" | "sent_request" | "received_request";
export interface FriendDeleteTarget {
  id: string;
  type: FriendDeleteKind;
  targetUserId: string;
}

export type FriendshipRelation =
  | { type: "SELF" }
  | { type: "ACCEPTED"; record: UserFriend }
  | { type: "SENT_PENDING"; record: UserFriend }
  | { type: "RECEIVED_PENDING"; record: UserFriend }
  | { type: "NONE" };

export interface FriendListPage {
  profiles: FriendUserProfile[];
  friends: UserFriend[];
  total: number;
  counts: Record<FriendTab, number>;
}

export type PlayerProfileSummary = Pick<FriendUserProfile, 'id' | 'level' | 'experience_point' | 'display_name' | 'avatar_url' | 'avatar_path' | 'country_id'>;

export type FriendStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED";

export interface UserFriend {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendStatus;
  created_at: string;
  updated_at: string;
}

export interface FriendUserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  country_id: string | null;
  experience_point: number;
  level: number;
  inventory_capacity: number;
  species_storage_capacity: number;
  created_at: string;
  updated_at: string;
}
