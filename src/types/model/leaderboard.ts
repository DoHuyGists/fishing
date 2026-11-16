export type LeaderboardCriterion = "score" | "total_caught" | "spend" | "best_fish";

export interface LeaderboardRewardTier {
  minPlayers: number;
  maxPlayers: number | null;
  rewards: { fromRank: number; toRank: number; tickets: number }[];
}

export interface LeaderboardRewardTier {
  minPlayers: number;
  maxPlayers: number | null;
  rewards: { fromRank: number; toRank: number; tickets: number }[];
}

export interface LeaderboardBestFish {
  id: string;
  species_id: string;
  name: string;
  image: string | null;
  rarity: string | null;
  weight: number;
  score: number;
  caught_at?: string;
  season_id?: string;
  session_id?: string;
}

export interface LeaderboardEntry {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
  score: number;
  total_caught: number | null;
  spend?: number | null;
  best_fish: LeaderboardBestFish | null;
  created_at: string;
  updated_at: string;
  rank?: number;
}

export interface LeaderboardRankedEntry {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  value: number;
  rank: number;
  bestFish?: LeaderboardBestFish | null;
}

export interface FishingSeason {
  id: string;
  season_number: number;
  starts_at: string;
  ends_at: string;
  finalized_at: string | null;
}

export interface FishingSeasonMeta {
  species_id: string;
  name: string;
  image: string | null;
  season_weight: number;
}

export interface FishingHallEntry {
  rank: number;
  user_id: string;
  display_name: string | null;
  fish: LeaderboardBestFish;
  caught_at: string;
}

export interface FishingSeasonBoard {
  items: LeaderboardEntry[];
  total: number;
  my_entry: LeaderboardEntry | null;
  season: FishingSeason | null;
  current_season_id: string | null;
  previous_season_id: string | null;
  next_season_id: string | null;
  hall_of_fame: FishingHallEntry[];
  meta: FishingSeasonMeta[];
  server_time: string;
}

export function leaderboardValue(entry: LeaderboardEntry, criterion: LeaderboardCriterion): number {
  if (criterion === "best_fish") return entry.best_fish?.score ?? 0;
  return entry[criterion] ?? 0;
}
