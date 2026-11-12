export interface SpeciesInAreaRow {
  id: string;
  areaId: string;
  speciesId: string;
  depthScopeId: string | null;
  weightRate: number;
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
