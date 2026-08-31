import type { FishingTool } from "../stores/fishing";
import type { EquipmentVariant } from "./equipmentCatalog";

// Abstraction over the equipment data source so the backend (Supabase or otherwise) can be swapped without touching feature code.
export interface EquipmentRepository {
  fetchEquipment(userId: string): Promise<Record<FishingTool, EquipmentVariant[]>>;
}
