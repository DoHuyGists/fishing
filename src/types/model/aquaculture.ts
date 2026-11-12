export type CareMode = 'simple' | 'advanced'

export type FarmAction = 'purchase_pond_slot' | 'stock_aquaculture_batch' | 'feed_aquaculture_batch'
  | 'care_aquaculture_pond' | 'sell_aquaculture_fish' | 'transfer_aquaculture_fish' | 'release_aquaculture_fish'

export interface AquacultureRules {
  species_id: string
  enabled: boolean
  rules_version: number
  capacity_per_fish: number
  grow_seconds: number
  seed_cash: number
  seed_weight_kg: number
  adult_weight_kg: number
  sale_cash_per_kg: number
  rare_chance: number
  advanced_rare_bonus: number
  rare_weight_multiplier: number
  feed_cooldown_seconds: number
}

export interface AquacultureBatch {
  id: string
  pond_id: string
  species_id: string
  mode: CareMode
  status: 'growing' | 'ready' | 'closed'
  initial_fish_count: number
  quality_score: number
  started_at: string
  ready_at: string
  feed_available_at: string
  rules_snapshot: AquacultureRules
}

export interface AquacultureFish {
  id: string
  batch_id: string
  species_id: string
  capacity: number
  status: 'growing' | 'ready'
  weight_kg: number
  star_rating: number
  is_shiny: boolean
  is_super_special: boolean
}

export interface AquaculturePond {
  id: string
  name: string
  slot_number: number
  level: number
  capacity: number
  used_capacity: number
  available_capacity: number
  care_available_at: string
  batches: AquacultureBatch[]
  fish: AquacultureFish[]
}

export interface AquacultureFarm {
  pond_slot: number
  server_time: string
  ponds: AquaculturePond[]
  species: (AquacultureRules & { can_stock: boolean })[]
}

export interface FarmSpecies { id: string; name: string; image: string | null }

export interface AquacultureFood {
  species_id: string
  item_id: string
  enabled: boolean
  capacity_units_per_item: number
  quality_gain: number
  item: { id: string; name: string; isDisabled: boolean | null } | null
}

export interface AquacultureCatalog { species: FarmSpecies[]; foods: AquacultureFood[] }

export interface FarmActionResult {
  pond_id?: string
  batch_id?: string
  cash_earned?: number
  transferred?: { fish_id: string; caught_id: string }[]
}

export interface PondSwimmer { id: string; image: string | null; special: boolean; progress: number }

export interface FarmFoodOption { inventoryId: string; itemId: string; name: string; needed: number; owned: number; gain: number }
