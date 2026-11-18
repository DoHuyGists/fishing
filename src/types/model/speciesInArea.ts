import type { SpeciesRow } from "../table/species";
import type { SpeciesInAreaRow, SpeciesBoundaryPoint, SpeciesDistributionBoundary } from "../table/speciesInArea";

export type AreaSpecies = Pick<SpeciesRow, "id" | "name" | "image" | "rarity" | "information" | "weight_min" | "weight_max">;

export interface SpeciesDistributionState {
  rows: SpeciesInAreaRow[];
  weights: Record<string, number | null>;
  boundary: SpeciesDistributionBoundary;
  originalBoundary: SpeciesDistributionBoundary;
  loading: boolean;
  loaded: boolean;
  saving: boolean;
  error: string;
  saved: boolean;
}

export type DistributionPoint = SpeciesBoundaryPoint;

export interface SpeciesDistributionZone {
  id: string;
  color: string;
  seed: DistributionPoint;
  power: number;
}

export interface SpeciesDistributionCell {
  id: string;
  polygon: DistributionPoint[];
  area: number;
  center: DistributionPoint;
}
