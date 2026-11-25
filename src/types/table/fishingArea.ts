export interface FishingSessionRow {
  id: string;
  status: string;
}

export type FishingAreaDetails = Pick<FishingAreaRow,
  'id' | 'countryId' | 'title' | 'location' | 'scenePath' | 'fishingBoundary' | 'maxDepth' | 'allowDepthTool' | 'survivalMode' | 'timezone'>;

export interface FishingAreaRow {
  id: string;
  createdAt: string;
  countryId: string;
  isAvailable: boolean;
  title: string | null;
  location: any;
  scenePath: string | null;
  fishingBoundary: any[];
  zoneId: string | null;
  maxDepth: number | null;
  allowDepthTool: boolean;
  survivalMode: boolean;
  timezone: string | null;
}

export interface FishingAreaPayload {
  survivalMode: boolean;
  timezone: string | null;
  allowDepthTool: boolean;
  countryId: string;
  isAvailable: boolean;
  title: string | null;
  location: any;
  scenePath: string | null;
  fishingBoundary: any[];
  zoneId: string | null;
  maxDepth: number | null;
}
