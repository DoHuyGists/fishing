import type { useInventoryTable } from "../../components/player/inventory/useInventoryTable";

export type InventoryTableContext = ReturnType<typeof useInventoryTable>;
export type InventoryTab = 'fishing' | 'health';
export type InventoryClassification = 'fishing' | 'body';
