import type { FishingAreaDetails } from '../table/fishingArea';

export type DayPhaseKey = 'dawn' | 'day' | 'dusk' | 'night';
export type FishingSceneArea = Pick<FishingAreaDetails, 'scenePath' | 'timezone'> & { id?: string };
export type FishingSceneVariants = Record<string, Partial<Record<DayPhaseKey, Record<string, string>>>>;
