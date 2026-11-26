import type { useEquipmentInventoryTable } from "../../components/player/player-equipment/useEquipmentInventoryTable";

export type EquipmentInventoryTableContext = ReturnType<typeof useEquipmentInventoryTable>;
export type EquipmentInventoryTab = 'fishing' | 'health';
export type InventoryClassification = 'fishing' | 'body';
