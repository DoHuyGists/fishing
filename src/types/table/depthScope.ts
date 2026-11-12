export interface DepthScopeRow {
  id: string;
  code: string;
  name: string;
  minDepth: number;
  maxDepth: number;
  peakDepth: number;
  curvePower: number;
  createdAt: string;
  updatedAt: string;
}

export type DepthScopePayload = Pick<DepthScopeRow, "code" | "name" | "minDepth" | "maxDepth" | "peakDepth" | "curvePower">;
