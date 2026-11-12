export type CaughtFishViewMode = "list" | "grid" | "species";

export interface MissionFish {
  id: string;
  name: string;
  image: string;
  length: string;
  rarity: string;
}

export interface HourMission {
  id: string;
  content: MissionFish[];
  start: string;
  end: string;
  cash: number;
}

export interface DailyMission {
  id: string;
  template_id: string;
  code: string;
  name: string;
  description: string;
  event_type: string;
  difficulty: string;
  target_value: number;
  current_value: number;
  mission_points: number;
  config: Record<string, unknown>;
  is_completed: boolean;
  completed_at: string | null;
}

export interface DailyMissionReward {
  id: string;
  required_points: number;
  reward_data: unknown[];
  is_unlocked: boolean;
  is_claimed: boolean;
  can_claim: boolean;
}

export interface DailyMissionData {
  mission_date: string;
  total_points: number;
  mission_count: number;
  missions: DailyMission[];
  rewards: DailyMissionReward[];
}
