import type { AquacultureRules } from "../model/aquaculture";

export type AquacultureRuleRow = AquacultureRules & { id: string; updated_at: string }

export type AquacultureRulePayload = Omit<AquacultureRules, 'rules_version'>

export interface AquacultureFoodPayload {
  species_id: string
  item_id: string
  enabled: boolean
  capacity_units_per_item: number
  quality_gain: number
}

export type AquacultureFoodRow = AquacultureFoodPayload & { id: string }
