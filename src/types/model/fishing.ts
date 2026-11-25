import type { FishingPhase, FishingCatchScore } from "./fishingGameplay";
import type { FishingSurvivalState } from './health';

export type FishingTool = "rod" | "line" | "reel" | "hook" | "bait";
export type CastPhase = FishingPhase;
export type CaughtFish = {
  id: string | number;
  name: string;
  weight: string;
  length?: string;
  image: string;
  createdAt?: string;
  isShiny?: boolean;
  variantType: "NORMAL" | "GOLDEN" | "MUTATED";
  starRating?: number;
  score?: number;
  seasonId?: string;
  seasonNumber?: number;
};
export type FishingPlayer = {
  id: string | number;
  userId?: string;
  name: string;
  level: number;
  title: string;
  caughtCount: number;
  bestCatch: string;
  avatar: string;
  color: string;
  isCurrentUser?: boolean;
};

export type CastRodResponse = {
  session_id: string;
  wait_time_ms: number;
  server_time_ms: number;
  survival?: FishingSurvivalState;
};

export type SubmitChallengeResponse = {
  success: boolean;
  survival?: FishingSurvivalState | null;
  scoring?: FishingCatchScore | null;
  message?: string;
  caught?: {
    id: string;
    name: string;
    rarity: string;
    weight: number;
    image: string | null;
    model_3d: string | null;
    is_shiny: boolean;
    variant_type: "NORMAL" | "GOLDEN" | "MUTATED";
    star_rating: number;
  };
};
