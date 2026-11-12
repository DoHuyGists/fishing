export interface BaseRow {
  id: string;
  created_at: string;
  updated_at: string | null;
  is_active: boolean;
}

export interface DailyMissionRewardRow extends BaseRow {
  required_points: number;
  reward_data: unknown[];
}

export interface DailyMissionTemplateRow extends BaseRow {
  code: string;
  name: string;
  description: string | null;
  event_type: string;
  target_value: number;
  mission_points: number;
  difficulty: string;
  weight: number;
  config: Record<string, unknown>;
}

export type RewardPayload = Omit<DailyMissionRewardRow, "id" | "created_at" | "updated_at">;

export type TemplatePayload = Omit<DailyMissionTemplateRow, "id" | "created_at" | "updated_at">;
