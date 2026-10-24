import supabase from "../database/connection";

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

function mapRow(row: any): DepthScopeRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    minDepth: Number(row.min_depth),
    maxDepth: Number(row.max_depth),
    peakDepth: Number(row.peak_depth),
    curvePower: Number(row.curve_power),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class SupabaseDepthScopeRepository {
  async fetchAll(): Promise<DepthScopeRow[]> {
    const { data, error } = await supabase.from("depth_scope").select("*").order("code", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  }

  async create(payload: DepthScopePayload): Promise<DepthScopeRow> {
    const { data, error } = await supabase.from("depth_scope").insert(this.toDatabase(payload)).select("*").single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async update(id: string, payload: DepthScopePayload): Promise<DepthScopeRow> {
    const { data, error } = await supabase.from("depth_scope").update(this.toDatabase(payload)).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("depth_scope").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  private toDatabase(payload: DepthScopePayload) {
    return {
      code: payload.code,
      name: payload.name,
      min_depth: payload.minDepth,
      max_depth: payload.maxDepth,
      peak_depth: payload.peakDepth,
      curve_power: payload.curvePower,
    };
  }
}

export const supabaseDepthScopeRepository = new SupabaseDepthScopeRepository();
