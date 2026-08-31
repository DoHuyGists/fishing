import type { FishingTool } from "../stores/fishing";
import supabase from "../database/connection";
import { defaultEquipmentVariants, type EquipmentVariant } from "./equipmentCatalog";
import type { EquipmentRepository } from "./equipmentRepository";

const COLUMN_BY_TOOL: Record<FishingTool, string> = {
  rod: "robs",
  line: "lines",
  reel: "reels",
  hook: "hooks",
  bait: "bait",
};

type EquipmentRow = Record<(typeof COLUMN_BY_TOOL)[FishingTool], EquipmentVariant[] | null>;

class SupabaseEquipmentRepository implements EquipmentRepository {
  async fetchEquipment(userId: string): Promise<Record<FishingTool, EquipmentVariant[]>> {
    const { data, error } = await supabase
      .from("equipments")
      .select("robs, lines, reels, hooks, bait")
      .eq("user_id", userId)
      .maybeSingle<EquipmentRow>();

    if (error) throw new Error(error.message);

    if (!data) return this.seedDefaultRow(userId);

    return {
      rod: data.robs ?? [],
      line: data.lines ?? [],
      reel: data.reels ?? [],
      hook: data.hooks ?? [],
      bait: data.bait ?? [],
    };
  }

  private async seedDefaultRow(userId: string): Promise<Record<FishingTool, EquipmentVariant[]>> {
    const seed = defaultEquipmentVariants;
    const { error } = await supabase.from("equipments").insert({
      user_id: userId,
      robs: seed.rod,
      lines: seed.line,
      reels: seed.reel,
      hooks: seed.hook,
      bait: seed.bait,
    });
    if (error) throw new Error(error.message);
    return seed;
  }
}

export const supabaseEquipmentRepository: EquipmentRepository = new SupabaseEquipmentRepository();
