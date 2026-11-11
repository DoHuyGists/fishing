import { t as tr } from "../i18n";
import supabase from "../database/connection";

export interface BlueprintMaterial {
  item_id: string;
  quantity: number;
}

function normalizeMaterials(value: unknown): BlueprintMaterial[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") throw new Error(tr('supabaseBlueprintRepository.cong_thuc_chua_nguyen_lieu_khong_hop_le'));
    const material = entry as Record<string, unknown>;
    const itemId = material.item_id;
    const quantity = Number(material.quantity);
    if (typeof itemId !== "string" || !itemId || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error(tr('supabaseBlueprintRepository.cong_thuc_chua_nguyen_lieu_hoac_so_luong_khong_hop_le'));
    return [{ item_id: itemId, quantity }];
  });
}

export interface Blueprint {
  id: string;
  resultItemId: string;
  resultQuantity: number;
  requiredMaterials: BlueprintMaterial[];
  goldCost: number;
}

class SupabaseBlueprintRepository {
  async save(payload: Record<string, unknown>, id: string | null) {
    const query = supabase.from("blueprint");
    const { error } = id ? await query.update(payload).eq("id", id) : await query.insert(payload);
    if (error) throw new Error(error.message);
  }
  async remove(id: string) {
    const { error } = await supabase.from("blueprint").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
  async craft(blueprintId: string, quantity: number): Promise<unknown> {
    const { data, error } = await supabase.rpc("craft_blueprint", {
      p_blueprint_id: blueprintId,
      p_quantity: quantity,
    });
    if (error) throw new Error(error.message);
    if (data?.success === false) throw new Error(data.message || tr('WorkBenchModal.khong_the_che_tao_vat_pham'));
    return data;
  }

  async fetchAll(): Promise<Blueprint[]> {
    const { data, error } = await supabase.from("blueprint").select("id,result_item_id,result_quantity,required_materials,gold_cost").order("created_at");
    if (error) throw new Error(error.message);
    return data.map((row) => ({
      id: row.id,
      resultItemId: row.result_item_id,
      resultQuantity: Number(row.result_quantity),
      requiredMaterials: normalizeMaterials(row.required_materials),
      goldCost: Number(row.gold_cost),
    }));
  }
}

export const supabaseBlueprintRepository = new SupabaseBlueprintRepository();
