import type { FishingTool } from "../stores/fishing";
import supabase from "../database/connection";
import { defaultEquipmentVariants, type EquipmentVariant } from "./equipmentCatalog";
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
  async fetchEquipment(userId: string): Promise<Record<FishingTool, EquipmentVariant[]>> {
    const { data, error } = await supabase.from("user_equipments").select("rod, line, reel, hook, bait").eq("user_id", userId).eq("is_used", true).maybeSingle<EquipmentRow>();

    if (error) throw new Error(error.message);

    if (!data) return this.seedDefaultRow(userId);

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
  async fetchAllEquipmentSet(userId: string): Promise<EquipmentSet[]> {
    const { data, error } = await supabase.from("user_equipments").select("*").eq("user_id", userId);

    if (error) throw new Error(error.message);

    return data.map((x) => ({
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

  async CreateNewSet(userId: string) {
    const { data, error } = await supabase.from("user_equipments").insert({ user_id: userId }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async UpdateSet(userId: string, set: EquipmentSet) {
    const { error } = await supabase.from("user_equipments").update({ rod: set.rod, line: set.line, reel: set.reel, hook: set.hook, bait: set.bait }).eq("id", set.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  private async seedDefaultRow(userId: string): Promise<Record<FishingTool, EquipmentVariant[]>> {
    const seed = defaultEquipmentVariants;
    const { error } = await supabase.from("user_equipments").insert({
      user_id: userId,
      rod: seed.rod,
      line: seed.line,
      reel: seed.reel,
      hook: seed.hook,
      bait: seed.bait,
    });
    if (error) throw new Error(error.message);
    return seed;
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
