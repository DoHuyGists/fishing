import type { FishingAreaRow } from '../table/fishingArea';
import type { SpeciesInAreaRow } from '../table/speciesInArea';

export type MapPoint = { x: number; y: number };

export type FishingMapArea = Pick<FishingAreaRow, 'id' | 'countryId' | 'title' | 'location' | 'scenePath'> & {
  species: SpeciesInAreaRow[];
};
