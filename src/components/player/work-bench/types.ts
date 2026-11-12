import type { BlueprintMaterial } from "../../../data/supabaseBlueprintRepository";
import type { Item } from "../../../data/supabaseItemRepository";

export interface WorkBenchInventoryItem {
  id: string;
  name: string;
  image: string | null;
  icon: string | null;
  quantity: number;
  itemId: string;
  category: string | null;
}

export interface WorkBenchMaterial extends BlueprintMaterial {
  item: Item | undefined;
  required: number;
  owned: number;
}
