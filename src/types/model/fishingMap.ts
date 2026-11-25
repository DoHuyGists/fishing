import type { FishingAreaRow } from '../table/fishingArea';
import type { SpeciesInAreaRow } from '../table/speciesInArea';
import type { SpeciesRow } from '../table/species';
import type { WeatherRow } from '../table/zone';

export type MapPoint = { x: number; y: number };

export type FishingMapSpecies = SpeciesInAreaRow & { details: SpeciesRow | null };

export type FishingMapAreaDetails = Pick<FishingAreaRow, 'id' | 'countryId' | 'title' | 'location' | 'scenePath' | 'isAvailable' | 'zoneId' | 'maxDepth' | 'allowDepthTool' | 'survivalMode' | 'timezone'> & {
  zone: { id: string; code: string; name: string; weathers: WeatherRow[] } | null;
};

export type FishingMapArea = FishingMapAreaDetails & {
  species: FishingMapSpecies[];
};
