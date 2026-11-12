export interface LeaderboardEntry {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
  score: number;
  created_at: string;
  updated_at: string;
}
