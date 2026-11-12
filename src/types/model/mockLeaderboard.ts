export type MockLeaderboardCriterion = "catches" | "largest" | "collection";

export interface MockLeaderboardEntry {
  id: string;
  displayName: string;
  value: number;
}
