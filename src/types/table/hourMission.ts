import type { MissionFish } from "../model/mission";

export interface HourMissionRow {
  id: string;
  createdAt: string;
  content: MissionFish[];
  start: string | null;
  end: string | null;
  isDisabled: boolean;
  cash: number | null;
}

export interface HourMissionPayload {
  content: MissionFish[];
  start: string | null;
  end: string | null;
  is_disabled: boolean;
  cash: number | null;
}
