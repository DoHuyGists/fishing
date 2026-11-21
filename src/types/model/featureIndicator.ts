import type { LobbyAction } from "./worldMap";

export const indicatorFeatures = ["attendance", "mission", "badge", "dispatch", "friend"] as const;
export type IndicatorFeature = (typeof indicatorFeatures)[number];
export type LobbyModal = LobbyAction["modal"];

export interface FeatureIndicator {
  rewardCount: number;
  attentionCount: number;
  nextChangeAt: string | null;
}

export interface FeatureIndicatorSnapshot {
  serverTime: string;
  indicators: Partial<Record<IndicatorFeature, FeatureIndicator>>;
}
