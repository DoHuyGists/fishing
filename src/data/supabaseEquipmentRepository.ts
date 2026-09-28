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

class SupabaseEquipmentRepository{
  async fetchEquipment(userId: string): Promise<Record<FishingTool, EquipmentVariant[]>> {
    const { data, error } = await supabase
      .from("user_equipments")
      .select("rod, line, reel, hook, bait")
      .eq("user_id", userId)
      .eq("isUsed", true)
      .maybeSingle<EquipmentRow>();

    if (error) throw new Error(error.message);

    if (!data) return this.seedDefaultRow(userId);

    return {
      rod: data.rod ?? [],
      line: data.line ?? [],
      reel: data.reel ?? [],
      hook: data.hook ?? [],
      bait: data.bait ?? [],
    };
  }
  async fetchAllEquipmentSet(userId: string): Promise<EquipmentSet[]> {
    const { data, error } = await supabase
      .from("user_equipments")
      .select("*")
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    return data.map(x => ({
      id: x.id,
      createdAt: x.created_at,
      userId: x.user_id,
      rod: x.rod ?? [],
      line: x.line ?? [],
      reel: x.reel ?? [],
      hook: x.hook ?? [],
      bait: x.bait ?? [],
    })) as EquipmentSet[]
  }

  async CreateNewSet(userId: string){
    const { data, error } = await supabase.from('user_equipments').insert({ user_id: userId }).select().single()
    if (error) throw new Error(error.message);
    return data;
  }

  async UpdateSet(userId: string, set: EquipmentSet){
    const { error } = await supabase
      .from('user_equipments')
      .update({ rod: set.rod, line: set.line, reel: set.reel, hook: set.hook, bait: set.bait })
      .eq('id', set.id)
      .eq('user_id', userId)
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
}

export const supabaseEquipmentRepository = new SupabaseEquipmentRepository();
