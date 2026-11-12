import type { DailyRewardPreview } from "../model/dailyReward";

export interface DailyRewardRow {
  id: string;
  item: Omit<DailyRewardPreview, "id">;
}
