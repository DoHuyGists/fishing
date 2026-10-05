import type { FishingTool } from "../stores/fishing";
import supabase from "../database/connection";
import { type EquipmentVariant } from "./equipmentCatalog";
import type { EquipmentSet } from "../stores/equipment";

const COLUMN_BY_TOOL: Record<FishingTool, string> = {
  rod: "rod",
  line: "line",
  reel: "reel",
  hook: "hook",
  bait: "bait",
};

type EquipmentRow = Record<(typeof COLUMN_BY_TOOL)[FishingTool], EquipmentVariant[] | null>;

class SupabaseEquipmentRepository {
  async fetchEquipment(): Promise<Record<FishingTool, EquipmentVariant[]>> {
    const { data, error } = await supabase.rpc("get_user_equipment_set_using").single<EquipmentRow>();

    if (error) throw new Error(error.message);

    const toVariants = (list: unknown[] | null): EquipmentVariant[] =>
      (list ?? []).map((raw) => {
        const item = raw as Record<string, any>;
        return {
          ...item,
          id: String(item.id),
          name: item.name ?? "",
          detail: item.detail ?? item.information ?? "",
          icon: item.icon ?? item.image ?? "❔",
        };
      });

    return {
      rod: toVariants(data.rod),
      line: toVariants(data.line),
      reel: toVariants(data.reel),
      hook: toVariants(data.hook),
      bait: toVariants(data.bait),
    };
  }
  async fetchAllEquipmentSet(): Promise<EquipmentSet[]> {
    const { data, error } = await supabase.rpc("get_all_user_equipment_sets");;

    if (error) throw new Error(error.message);

    return data.map((x: any) => ({
      id: x.id,
      createdAt: x.created_at,
      userId: x.user_id,
      rod: x.rod ?? [],
      line: x.line ?? [],
      reel: x.reel ?? [],
      hook: x.hook ?? [],
      bait: x.bait ?? [],
      isUsed: x.is_used,
    })) as EquipmentSet[];
  }

  async CreateNewSet() {
    const { data, error } = await supabase.rpc('buy_equipment_set');

    if (error) {
      if (error) throw new Error(error.message);
    }
    return data;
  }

  async UpdateSet(userId: string, set: EquipmentSet) {
    const { error } = await supabase.from("user_equipments").update({ rod: set.rod, line: set.line, reel: set.reel, hook: set.hook, bait: set.bait }).eq("id", set.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  async selectItem(itemId: string) {
    const { error } = await supabase.rpc("select_current_fishing_item", { item_id: itemId });
    if (error) throw new Error(error.message);
  }

  async fetchSelected(userId: string): Promise<Partial<Record<FishingTool, string>>> {
    const { data, error } = await supabase.from("user_equipment_selected").select("rod, line, reel, hook, bait").eq("user_id", userId).maybeSingle<Record<FishingTool, { id?: string } | null>>();
    if (error) throw new Error(error.message);
    const result: Partial<Record<FishingTool, string>> = {};
    if (!data) return result;
    for (const tool of Object.keys(COLUMN_BY_TOOL) as FishingTool[]) {
      const id = data[tool]?.id;
      if (id) result[tool] = id;
    }
    return result;
  }

  async updateCurrentUsedSet(userId: string, setId: string) {
    const { error } = await supabase.rpc("switch_equipment", {
      p_id: setId,
      p_user_id: userId,
    });

    if (error) throw new Error(error.message);
  }
}

export const supabaseEquipmentRepository = new SupabaseEquipmentRepository();
