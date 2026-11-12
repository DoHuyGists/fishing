import type { createTensionFight } from "../../data/tensionChallenge";

export type TensionResult = "fighting" | "won" | "snapped" | "escaped" | "timeout";

export type TensionInput = { tick: number; reeling: boolean };

export type TensionSubmission = {
  sessionId: string;
  inputs: TensionInput[];
  totalTicks: number;
  claimedResult: Exclude<TensionResult, "fighting">;
};

export type TensionChallenge = {
  sessionId: string;
  type: "tension-challenge";
  version: 1;
  seed: number;
  startedAt: number;
  expiresAt: number;
  activatedAt?: number;
  config: {
    tickRate: number;
    safeMin: number;
    safeMax: number;
    maxTension: number;
    startTension: number;
    startDistance: number;
    reelRate: number;
    releaseRate: number;
    reelSpeed: number;
    slackEscapeSeconds: number;
    slackThresholdRatio: number;
    slackDistanceRate: number;
    fishPullMultiplier: number;
    minimumStrength: number;
  };
  fish: {
    id: string;
    baseStrength: number;
    burstChance: number;
    burstMin: number;
    burstMax: number;
    staminaDrain: number;
    basePull: number;
    pullAmplitude: number;
    pullPeriodTicks: number;
    burstMinTicks: number;
    burstMaxTicks: number;
  };
};

export type TensionFight = ReturnType<typeof createTensionFight>;
