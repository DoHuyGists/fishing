export type FriendTab = "friends" | "received" | "sent" | "discover";

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
