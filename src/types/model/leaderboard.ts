export type LeaderboardCriterion = "score" | "total_caught" | "best_fish";

export interface LeaderboardBestFish {
  id: string;
  species_id: string;
  name: string;
  image: string | null;
  rarity: string;
  weight: number;
  score: number;
}

export interface LeaderboardEntry {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
  score: number;
  total_caught: number | null;
  best_fish: LeaderboardBestFish | null;
  created_at: string;
  updated_at: string;
}

export function leaderboardValue(entry: LeaderboardEntry, criterion: LeaderboardCriterion): number {
  if (criterion === "best_fish") return entry.best_fish?.score ?? 0;
  return entry[criterion] ?? 0;
}
