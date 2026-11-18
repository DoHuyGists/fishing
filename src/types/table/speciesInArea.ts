export interface SpeciesBoundaryPoint { x: number; y: number }

export type SpeciesBoundaryShape = 'natural' | 'ellipse' | 'circle' | 'rect' | 'square' | 'round' | 'hex';

export interface SpeciesDistributionBoundary {
  version: 1;
  shape: SpeciesBoundaryShape;
  width: number;
  height: number;
  nodes: SpeciesBoundaryPoint[];
}

export interface SpeciesInAreaRow {
  id: string;
  areaId: string;
  speciesId: string;
  depthScopeId: string | null;
  weightRate: number;
  boundary: SpeciesDistributionBoundary | null;
  areaTitle: string | null;
  areaCountryId: string | null;
  speciesName: string | null;
  speciesImage: string | null;
  speciesRarity: string | null;
}

export interface SpeciesInAreaPayload {
  areaId: string;
  speciesId: string;
  weightRate: number;
  depthScopeId: string | null;
}

export interface SpeciesInAreaWeightUpdate {
  speciesId: string;
  weightRate: number;
  previousWeightRate: number;
  boundary: SpeciesDistributionBoundary;
  previousBoundary: SpeciesDistributionBoundary | null;
}
