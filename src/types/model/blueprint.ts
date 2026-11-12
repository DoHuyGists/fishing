export interface BlueprintMaterial {
  item_id: string;
  quantity: number;
}

export interface Blueprint {
  id: string;
  resultItemId: string;
  resultQuantity: number;
  requiredMaterials: BlueprintMaterial[];
  goldCost: number;
}
