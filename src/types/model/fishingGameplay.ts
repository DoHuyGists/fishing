import type { MapPoint } from "./fishingMap";
import type { TensionChallenge, TensionFight } from "./tensionChallenge";

export type FishingPhase = "idle" | "casting" | "waiting" | "bite" | "submitting" | "unconfirmed" | "caught" | "lost";

export interface FishingCatchScore {
  score: number;
  season_id: string;
  season_number: number;
  caught_at: string;
}

// The scene and controls consume this contract without owning a database session.
export interface FishingSceneState extends Pick<TensionController,
  "tensionChallenge" | "tensionFight" | "tensionStartedAt" | "tensionReeling"> {
  canCast: boolean;
  castPhase: FishingPhase;
  baitRetrievalSequence: number;
  baitPosition: MapPoint;
  castMessage: string;
  currentArea: { fishingBoundary?: MapPoint[] };
  castTo(x: number, y: number): void;
  rejectCast(message?: string): void;
}

export interface FishingSceneContext {
  state: FishingSceneState;
  sceneImage: string;
  fallbackSceneImage?: string;
  sceneKey?: string;
  rodImage: string;
}

export interface TensionController {
  tensionChallenge: TensionChallenge | null;
  tensionFight: TensionFight | null;
  tensionStartedAt: number | null;
  tensionReeling: boolean;
  serverClockOffset: number;
  castPhase: FishingPhase;
  isStartingTensionChallenge: boolean;
  advanceTensionFight(now?: number): void;
  setTensionReeling(reeling: boolean): void;
}
