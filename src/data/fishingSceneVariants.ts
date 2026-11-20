import type { DayPhaseKey, FishingSceneVariants } from '../types/model/fishingScene';

// Register only assets that exist. Weather codes must match weathers.code.
export const fishingSceneVariants: FishingSceneVariants = {
  '/area/VN/777.430': {
    night: { RAIN: 'night_rain.png' },
  },
  '/area/VN/780.420': {
    day: { RAIN: 'day_rain.png' },
  },
};

export function resolveFishingScene(scenePath: string | null | undefined, phase: DayPhaseKey | null, weatherCode?: string | null) {
  if (!scenePath || !phase) return '';
  const path = scenePath.replace(/\/+$/, '');
  const code = weatherCode?.trim().toUpperCase();
  const variant = code ? fishingSceneVariants[path]?.[phase]?.[code] : undefined;
  return `${path}/${variant ?? `${phase}.png`}`;
}
